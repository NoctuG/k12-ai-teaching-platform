CREATE TABLE `classes` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `stage` varchar(64) NOT NULL,
  `grade` varchar(64) NOT NULL,
  `term` varchar(64) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `classes_id` PRIMARY KEY(`id`)
);

CREATE TABLE `students` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `classId` int NOT NULL,
  `name` varchar(128) NOT NULL,
  `studentNo` varchar(64),
  `status` enum('active','inactive','graduated') NOT NULL DEFAULT 'active',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `students_id` PRIMARY KEY(`id`)
);

CREATE TABLE `student_performance_records` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `classId` int NOT NULL,
  `studentId` int NOT NULL,
  `recordAt` timestamp NOT NULL DEFAULT (now()),
  `dimension` varchar(128) NOT NULL,
  `indicator` varchar(128) NOT NULL,
  `teacherNote` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `student_performance_records_id` PRIMARY KEY(`id`)
);

CREATE TABLE `student_comment_generations` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `classId` int NOT NULL,
  `studentId` int NOT NULL,
  `term` varchar(64) NOT NULL,
  `batchTitle` varchar(255) NOT NULL,
  `commentType` enum('final_term','homework','daily','custom') NOT NULL,
  `performance` text,
  `comment` text NOT NULL,
  `status` enum('pending','generating','completed','failed') NOT NULL DEFAULT 'pending',
  `generatedAt` timestamp NOT NULL DEFAULT (now()),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `student_comment_generations_id` PRIMARY KEY(`id`)
);

-- 兼容迁移：按旧批次先创建“历史导入班级”
INSERT INTO `classes` (`userId`, `name`, `stage`, `grade`, `term`, `createdAt`, `updatedAt`)
SELECT DISTINCT
  sc.`userId`,
  CONCAT('历史导入-', DATE_FORMAT(sc.`createdAt`, '%Y%m%d'), '-', sc.`id`) AS `name`,
  '未知学段',
  '未知年级',
  DATE_FORMAT(sc.`createdAt`, '%Y') AS `term`,
  sc.`createdAt`,
  sc.`updatedAt`
FROM `student_comments` sc;

-- 将旧 students JSON 拆分为结构化 students
INSERT INTO `students` (`userId`, `classId`, `name`, `studentNo`, `status`, `createdAt`, `updatedAt`)
SELECT
  sc.`userId`,
  c.`id` AS `classId`,
  jt.`name`,
  NULL,
  'active',
  sc.`createdAt`,
  sc.`updatedAt`
FROM `student_comments` sc
JOIN `classes` c
  ON c.`userId` = sc.`userId`
  AND c.`name` = CONCAT('历史导入-', DATE_FORMAT(sc.`createdAt`, '%Y%m%d'), '-', sc.`id`)
JOIN JSON_TABLE(
  sc.`students`,
  '$[*]' COLUMNS(
    `name` varchar(128) PATH '$.name'
  )
) jt;

-- 旧评语结果拆分进入 student_comment_generations 作为只读历史
INSERT INTO `student_comment_generations` (`userId`, `classId`, `studentId`, `term`, `batchTitle`, `commentType`, `performance`, `comment`, `status`, `generatedAt`, `createdAt`, `updatedAt`)
SELECT
  sc.`userId`,
  c.`id` AS `classId`,
  s.`id` AS `studentId`,
  DATE_FORMAT(sc.`createdAt`, '%Y') AS `term`,
  sc.`batchTitle`,
  sc.`commentType`,
  jt.`performance`,
  COALESCE(jt.`comment`, ''),
  sc.`status`,
  sc.`createdAt`,
  sc.`createdAt`,
  sc.`updatedAt`
FROM `student_comments` sc
JOIN `classes` c
  ON c.`userId` = sc.`userId`
  AND c.`name` = CONCAT('历史导入-', DATE_FORMAT(sc.`createdAt`, '%Y%m%d'), '-', sc.`id`)
JOIN JSON_TABLE(
  sc.`students`,
  '$[*]' COLUMNS(
    `name` varchar(128) PATH '$.name',
    `performance` text PATH '$.performance',
    `comment` text PATH '$.comment'
  )
) jt
JOIN `students` s
  ON s.`classId` = c.`id`
  AND s.`name` = jt.`name`;
