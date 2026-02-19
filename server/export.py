#!/usr/bin/env python3
"""
Export utility for generating Word and PowerPoint files from text content.
"""
import sys
import json
from docx import Document
from docx.shared import Pt, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from pptx import Presentation
from pptx.util import Inches, Pt as PptPt
from pptx.enum.text import PP_ALIGN

def export_to_word(content: str, title: str, output_path: str):
    """Export content to Word document"""
    doc = Document()
    
    # Add title
    title_paragraph = doc.add_paragraph()
    title_run = title_paragraph.add_run(title)
    title_run.font.size = Pt(18)
    title_run.font.bold = True
    title_paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    
    # Add空行
    doc.add_paragraph()
    
    # Add content
    paragraphs = content.split('\n\n')
    for para in paragraphs:
        if para.strip():
            p = doc.add_paragraph(para.strip())
            p_format = p.paragraph_format
            p_format.line_spacing = 1.5
            p_format.space_after = Pt(12)
    
    doc.save(output_path)
    return output_path

def export_to_ppt(content: str, title: str, output_path: str):
    """Export content to PowerPoint presentation"""
    prs = Presentation()
    prs.slide_width = Inches(10)
    prs.slide_height = Inches(7.5)
    
    # Title slide
    title_slide_layout = prs.slide_layouts[0]
    slide = prs.slides.add_slide(title_slide_layout)
    slide.shapes.title.text = title
    
    # Split content into sections
    sections = content.split('\n\n')
    
    # Create content slides
    for section in sections:
        if not section.strip():
            continue
            
        # Use title and content layout
        bullet_slide_layout = prs.slide_layouts[1]
        slide = prs.slides.add_slide(bullet_slide_layout)
        
        # Extract title from first line if it looks like a heading
        lines = section.strip().split('\n')
        if len(lines) > 0:
            first_line = lines[0].strip()
            # Check if first line is a heading (short and ends with colon or is numbered)
            if len(first_line) < 50 and (first_line.endswith(':') or first_line.endswith('：') or first_line[0].isdigit()):
                slide.shapes.title.text = first_line.rstrip(':：')
                content_lines = lines[1:]
            else:
                slide.shapes.title.text = first_line[:30] + "..." if len(first_line) > 30 else first_line
                content_lines = lines
            
            # Add content
            if len(content_lines) > 0:
                text_frame = slide.placeholders[1].text_frame
                text_frame.clear()
                
                for line in content_lines:
                    if line.strip():
                        p = text_frame.add_paragraph()
                        p.text = line.strip()
                        p.level = 0
                        p.font.size = PptPt(18)
    
    prs.save(output_path)
    return output_path

def main():
    if len(sys.argv) < 5:
        print(json.dumps({"error": "Usage: export.py <format> <title> <content> <output_path>"}))
        sys.exit(1)
    
    format_type = sys.argv[1]
    title = sys.argv[2]
    content = sys.argv[3]
    output_path = sys.argv[4]
    
    try:
        if format_type == "word":
            result_path = export_to_word(content, title, output_path)
        elif format_type == "ppt":
            result_path = export_to_ppt(content, title, output_path)
        else:
            print(json.dumps({"error": f"Unsupported format: {format_type}"}))
            sys.exit(1)
        
        print(json.dumps({"success": True, "path": result_path}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
