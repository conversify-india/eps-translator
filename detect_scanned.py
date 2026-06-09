#!/usr/bin/env python3
import fitz
import sys
import json

def is_scanned_page(page):
    pw, ph = page.rect.width, page.rect.height
    text = page.get_text().strip()
    images = page.get_images(full=True)
    
    # Condition 1: No text at all
    if not text:
        return True, "no_text"
        
    # Condition 2: Very little text and at least one image
    if len(text) < 150 and images:
        return True, "sparse_text_with_image"
        
    # Condition 3: A giant image covering > 85% of the page
    for img_info in images:
        try:
            img_rects = page.get_image_bbox(img_info)
            rect = img_rects if isinstance(img_rects, fitz.Rect) else (img_rects[0] if img_rects else None)
            if rect:
                img_area = rect.width * rect.height
                page_area = pw * ph
                if img_area > page_area * 0.85:
                    if len(text) < 1200 or len(images) == 1:
                        return True, "giant_image_covering_page"
        except:
            pass
            
    return False, "digital"

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"scanned": False, "reason": "no_file"}))
        sys.exit(0)
        
    pdf_path = sys.argv[1]
    try:
        doc = fitz.open(pdf_path)
    except Exception as e:
        print(json.dumps({"scanned": False, "reason": f"error_opening: {e}"}))
        sys.exit(0)
        
    scanned_count = 0
    details = []
    for i, page in enumerate(doc):
        scanned, reason = is_scanned_page(page)
        if scanned:
            scanned_count += 1
        details.append({"page": i+1, "scanned": scanned, "reason": reason})
        
    is_scanned = scanned_count > 0
    print(json.dumps({
        "scanned": is_scanned,
        "scanned_pages_count": scanned_count,
        "total_pages": len(doc),
        "details": details
    }))

if __name__ == "__main__":
    main()
