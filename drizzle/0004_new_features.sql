-- Add new resource types to generation_history enum
ALTER TABLE `generation_history` MODIFY COLUMN `resourceType` enum('courseware','exam','lesson_plan','lesson_plan_unit','transcript','lecture_script','homework','question_design','grading_rubric','learning_report','interactive_game','discussion_chain','mind_map','parent_letter','parent_meeting_speech','pbl_project','school_curriculum','competition_questions','pacing_guide','differentiated_reading') NOT NULL;

-- Add new resource types to resource_templates enum
ALTER TABLE `resource_templates` MODIFY COLUMN `resourceType` enum('courseware','exam','lesson_plan','lesson_plan_unit','transcript','lecture_script','homework','question_design','grading_rubric','learning_report','interactive_game','discussion_chain','mind_map','parent_letter','parent_meeting_speech','pbl_project','school_curriculum','competition_questions','pacing_guide','differentiated_reading') NOT NULL;

-- Add isFavorite column to generation_history
ALTER TABLE `generation_history` ADD COLUMN `isFavorite` int NOT NULL DEFAULT 0;

-- Add sharing columns to generation_history
ALTER TABLE `generation_history` ADD COLUMN `isShared` int NOT NULL DEFAULT 0;
ALTER TABLE `generation_history` ADD COLUMN `shareToken` varchar(64);
