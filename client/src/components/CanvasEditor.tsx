import { useState, useRef, useCallback, useEffect } from "react";
import {
  type Block,
  type BlockType,
  parseMarkdown,
  serializeBlocks,
  createEmptyBlock,
} from "@/lib/markdown-blocks";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Streamdown } from "streamdown";
import {
  GripVertical,
  Plus,
  Trash2,
  Save,
  Eye,
  Pencil,
  Heading,
  AlignLeft,
  List,
  Code,
  Table,
  Quote,
  Minus,
  ChevronUp,
  ChevronDown,
  Bold,
  Italic,
  Code2,
  Link2,
  Highlighter,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const blockTypeLabels: Record<BlockType, string> = {
  heading: "标题",
  paragraph: "段落",
  list: "列表",
  code: "代码块",
  table: "表格",
  blockquote: "引用",
  hr: "分隔线",
};

const blockTypeIcons: Record<BlockType, React.ReactNode> = {
  heading: <Heading className="w-3.5 h-3.5" />,
  paragraph: <AlignLeft className="w-3.5 h-3.5" />,
  list: <List className="w-3.5 h-3.5" />,
  code: <Code className="w-3.5 h-3.5" />,
  table: <Table className="w-3.5 h-3.5" />,
  blockquote: <Quote className="w-3.5 h-3.5" />,
  hr: <Minus className="w-3.5 h-3.5" />,
};

interface CanvasEditorProps {
  content: string;
  onSave: (content: string) => void;
  saving?: boolean;
  readOnly?: boolean;
  onContentChange?: (content: string) => void;
  onCursorChange?: (anchor: string) => void;
  remotePresence?: Array<{ userId: number; cursorAnchor: string | null }>;
}

export default function CanvasEditor({
  content,
  onSave,
  saving,
  readOnly,
  onContentChange,
  onCursorChange,
  remotePresence,
}: CanvasEditorProps) {
  const [blocks, setBlocks] = useState<Block[]>(() => parseMarkdown(content));
  const [activeTab, setActiveTab] = useState<string>("edit");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragCounterRef = useRef(0);

  // Sync blocks when external content changes
  useEffect(() => {
    setBlocks(parseMarkdown(content));
  }, [content]);

  const handleSave = useCallback(() => {
    onSave(serializeBlocks(blocks));
  }, [blocks, onSave]);

  const updateBlock = useCallback((id: string, updates: Partial<Block>) => {
    setBlocks(prev => prev.map(b => (b.id === id ? { ...b, ...updates } : b)));
  }, []);

  const removeBlock = useCallback((id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
  }, []);

  const addBlockAfter = useCallback((afterId: string, type: BlockType) => {
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === afterId);
      const newBlock = createEmptyBlock(type);
      const next = [...prev];
      next.splice(idx + 1, 0, newBlock);
      return next;
    });
  }, []);

  const addBlockAtEnd = useCallback((type: BlockType) => {
    setBlocks(prev => [...prev, createEmptyBlock(type)]);
  }, []);

  const moveBlock = useCallback((fromIdx: number, toIdx: number) => {
    setBlocks(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }, []);

  const moveBlockUp = useCallback(
    (idx: number) => {
      if (idx <= 0) return;
      moveBlock(idx, idx - 1);
    },
    [moveBlock]
  );

  const moveBlockDown = useCallback((idx: number) => {
    setBlocks(prev => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      const [moved] = next.splice(idx, 1);
      next.splice(idx + 1, 0, moved);
      return next;
    });
  }, []);

  // --- Drag handlers ---
  const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
    setDragIndex(idx);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
  }, []);

  const handleDragEnter = useCallback((idx: number) => {
    dragCounterRef.current++;
    setDragOverIndex(idx);
  }, []);

  const handleDragLeave = useCallback(() => {
    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) {
      setDragOverIndex(null);
      dragCounterRef.current = 0;
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, toIdx: number) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      if (dragIndex !== null && dragIndex !== toIdx) {
        moveBlock(dragIndex, toIdx);
      }
      setDragIndex(null);
      setDragOverIndex(null);
    },
    [dragIndex, moveBlock]
  );

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDragOverIndex(null);
    dragCounterRef.current = 0;
  }, []);

  const previewMarkdown = serializeBlocks(blocks);

  useEffect(() => {
    onContentChange?.(previewMarkdown);
  }, [onContentChange, previewMarkdown]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b bg-background px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="edit">
                <Pencil className="w-3.5 h-3.5 mr-1.5" />
                编辑
              </TabsTrigger>
              <TabsTrigger value="preview">
                <Eye className="w-3.5 h-3.5 mr-1.5" />
                预览
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Badge variant="outline" className="text-xs font-normal">
            {blocks.length} 个内容块
          </Badge>
          {!!remotePresence?.length && (
            <Badge variant="secondary" className="text-xs font-normal">
              在线光标 {remotePresence.length}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <AddBlockMenu onAdd={addBlockAtEnd} label="添加块" />
          <Button size="sm" onClick={handleSave} disabled={saving || readOnly}>
            <Save className="w-4 h-4 mr-1.5" />
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>

      {/* Content area */}
      {activeTab === "edit" ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {blocks.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <p className="mb-4 font-light">暂无内容块</p>
              <AddBlockMenu onAdd={addBlockAtEnd} label="添加第一个内容块" />
            </div>
          )}
          {blocks.map((block, idx) => (
            <div
              key={block.id}
              draggable={!readOnly}
              onDragStart={e => handleDragStart(e, idx)}
              onDragEnter={() => handleDragEnter(idx)}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={e => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
              className={`transition-all ${
                dragIndex === idx ? "opacity-40" : ""
              } ${
                dragOverIndex === idx && dragIndex !== idx
                  ? "ring-2 ring-primary ring-offset-2 rounded-lg"
                  : ""
              }`}
            >
              <BlockEditor
                block={block}
                index={idx}
                total={blocks.length}
                onUpdate={updateBlock}
                onRemove={removeBlock}
                onAddAfter={addBlockAfter}
                onMoveUp={moveBlockUp}
                onMoveDown={moveBlockDown}
                onFocusBlock={onCursorChange}
                readOnly={!!readOnly}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="prose prose-sm max-w-none">
            <Streamdown>{previewMarkdown}</Streamdown>
          </div>
        </div>
      )}
    </div>
  );
}

// ----- Block Editor -----

interface BlockEditorProps {
  block: Block;
  index: number;
  total: number;
  onUpdate: (id: string, updates: Partial<Block>) => void;
  onRemove: (id: string) => void;
  onAddAfter: (afterId: string, type: BlockType) => void;
  onMoveUp: (idx: number) => void;
  onMoveDown: (idx: number) => void;
  onFocusBlock?: (anchor: string) => void;
  readOnly: boolean;
}

function BlockEditor({
  block,
  index,
  total,
  onUpdate,
  onRemove,
  onAddAfter,
  onMoveUp,
  onMoveDown,
  onFocusBlock,
  readOnly,
}: BlockEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, []);

  const updateContentWithSelection = useCallback(
    (nextContent: string, selectionStart: number, selectionEnd: number) => {
      onUpdate(block.id, { content: nextContent });
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(selectionStart, selectionEnd);
        autoResize();
      });
    },
    [autoResize, block.id, onUpdate]
  );

  const applyInlineFormat = useCallback(
    (type: "bold" | "italic" | "code" | "link" | "highlight") => {
      const el = textareaRef.current;
      if (!el) return;

      const content = block.content;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const selected = content.slice(start, end);
      const hasSelection = start !== end;

      let insertText = "";
      let selectionStart = start;
      let selectionEnd = end;

      if (type === "link") {
        const label = hasSelection ? selected : "链接文本";
        const url = "https://";
        insertText = `[${label}](${url})`;
        selectionStart = start + label.length + 3;
        selectionEnd = selectionStart + url.length;
      } else {
        const placeholder =
          type === "bold"
            ? "加粗文本"
            : type === "italic"
              ? "斜体文本"
              : type === "code"
                ? "代码"
                : "高亮文本";
        const target = hasSelection ? selected : placeholder;
        const wrapper =
          type === "bold"
            ? "**"
            : type === "italic"
              ? "*"
              : type === "code"
                ? "`"
                : "==";

        insertText = `${wrapper}${target}${wrapper}`;
        selectionStart = start + wrapper.length;
        selectionEnd = selectionStart + target.length;
      }

      const nextContent = `${content.slice(0, start)}${insertText}${content.slice(end)}`;
      updateContentWithSelection(nextContent, selectionStart, selectionEnd);
    },
    [block.content, updateContentWithSelection]
  );

  const handleEditorKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!(e.metaKey || e.ctrlKey)) return;

      const key = e.key.toLowerCase();
      if (key === "b") {
        e.preventDefault();
        applyInlineFormat("bold");
      } else if (key === "i") {
        e.preventDefault();
        applyInlineFormat("italic");
      } else if (key === "k") {
        e.preventDefault();
        applyInlineFormat("link");
      } else if (key === "e") {
        e.preventDefault();
        applyInlineFormat("code");
      } else if (key === "h") {
        e.preventDefault();
        applyInlineFormat("highlight");
      }
    },
    [applyInlineFormat]
  );

  useEffect(() => {
    autoResize();
  }, [block.content, autoResize]);

  const isHr = block.type === "hr";

  return (
    <Card className="group relative border hover:border-primary/30 transition-colors">
      <div className="flex items-start">
        {/* Drag handle + controls */}
        <div className="flex flex-col items-center gap-0.5 py-2 pl-1 pr-0 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted text-muted-foreground"
            onMouseDown={e => e.stopPropagation()}
            title="拖拽排序"
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <button
            className="p-1 rounded hover:bg-muted text-muted-foreground disabled:opacity-30"
            onClick={() => onMoveUp(index)}
            disabled={readOnly || index === 0}
            title="上移"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            className="p-1 rounded hover:bg-muted text-muted-foreground disabled:opacity-30"
            onClick={() => onMoveDown(index)}
            disabled={readOnly || index === total - 1}
            title="下移"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Block content */}
        <div className="flex-1 min-w-0 py-2 pr-2">
          {/* Block type badge */}
          <div className="flex items-center gap-2 mb-1.5">
            <Badge
              variant="secondary"
              className="text-[10px] font-normal gap-1 px-1.5 py-0"
            >
              {blockTypeIcons[block.type]}
              {blockTypeLabels[block.type]}
              {block.type === "heading" && block.level && ` H${block.level}`}
            </Badge>

            {block.type === "heading" && (
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5, 6].map(lvl => (
                  <button
                    key={lvl}
                    className={`text-[10px] w-5 h-5 rounded flex items-center justify-center transition-colors ${
                      block.level === lvl
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted text-muted-foreground"
                    }`}
                    onClick={() => onUpdate(block.id, { level: lvl })}
                    disabled={readOnly}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            )}

            <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <AddBlockMenu
                onAdd={type => onAddAfter(block.id, type)}
                label=""
                compact
              />
              <button
                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                onClick={() => onRemove(block.id)}
                disabled={readOnly}
                title="删除此块"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Editable content */}
          {isHr ? (
            <hr className="my-2 border-border" />
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1 text-muted-foreground">
                {[
                  {
                    type: "bold" as const,
                    icon: <Bold className="w-3.5 h-3.5" />,
                    title: "加粗",
                    shortcut: "Ctrl/Cmd+B",
                  },
                  {
                    type: "italic" as const,
                    icon: <Italic className="w-3.5 h-3.5" />,
                    title: "斜体",
                    shortcut: "Ctrl/Cmd+I",
                  },
                  {
                    type: "code" as const,
                    icon: <Code2 className="w-3.5 h-3.5" />,
                    title: "行内代码",
                    shortcut: "Ctrl/Cmd+E",
                  },
                  {
                    type: "link" as const,
                    icon: <Link2 className="w-3.5 h-3.5" />,
                    title: "链接",
                    shortcut: "Ctrl/Cmd+K",
                  },
                  {
                    type: "highlight" as const,
                    icon: <Highlighter className="w-3.5 h-3.5" />,
                    title: "高亮",
                    shortcut: "Ctrl/Cmd+H",
                  },
                ].map(action => (
                  <Tooltip key={action.type}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="p-1 rounded hover:bg-muted transition-colors"
                        onClick={() => applyInlineFormat(action.type)}
                        disabled={readOnly}
                      >
                        {action.icon}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      {action.title}（{action.shortcut}）
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
              <textarea
                ref={textareaRef}
                value={block.content}
                readOnly={readOnly}
                onFocus={() => onFocusBlock?.(block.id)}
                onChange={e => {
                  if (readOnly) return;
                  onUpdate(block.id, { content: e.target.value });
                  autoResize();
                }}
                onKeyDown={handleEditorKeyDown}
                className="w-full resize-none bg-transparent border-0 outline-none text-sm font-mono leading-relaxed placeholder:text-muted-foreground/50 min-h-[2rem]"
                placeholder="在此输入内容..."
                rows={1}
              />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// ----- Add Block Menu -----

function AddBlockMenu({
  onAdd,
  label,
  compact,
}: {
  onAdd: (type: BlockType) => void;
  label?: string;
  compact?: boolean;
}) {
  const blockTypes: BlockType[] = [
    "heading",
    "paragraph",
    "list",
    "code",
    "table",
    "blockquote",
    "hr",
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {compact ? (
          <button
            className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors"
            title="在此之后添加块"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        ) : (
          <Button variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-1.5" />
            {label || "添加块"}
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {blockTypes.map(type => (
          <DropdownMenuItem key={type} onClick={() => onAdd(type)}>
            <span className="mr-2">{blockTypeIcons[type]}</span>
            {blockTypeLabels[type]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
