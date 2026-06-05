import fitz
import os
import tempfile

src = r"c:\Users\USER\Downloads\이력서예제_갱신 (1) (1).pdf"
old_url = "https://dvdholic-01a66e19fbd3.herokuapp.com/"
new_url = "https://touraz-dvdholic-2507bcb348dd.herokuapp.com/"

doc = fitz.open(src)
page_text = doc[2].get_text()
needs_edit = old_url in page_text or "touraz-dvdholic-2507bcb348dd" not in page_text

if needs_edit:
    page = doc[2]
    rect = fitz.Rect(52.5, 531.5, 248, 545.5)
    page.add_redact_annot(rect, fill=(1, 1, 1))
    page.apply_redactions()
    color = (55 / 255, 55 / 255, 236 / 255)
    page.insert_text(
        fitz.Point(52.95, 542.2),
        new_url,
        fontsize=8.4,
        fontname="helv",
        cor=color,
    )

fd, tmp = tempfile.mkstemp(suffix=".pdf", dir=os.path.dirname(src))
os.close(fd)
doc.save(tmp, garbage=4, deflate=True)
doc.close()
os.replace(tmp, src)

doc2 = fitz.open(src)
t2 = doc2[2].get_text()
doc2.close()

print("overwritten:", src)
print("touraz_ok:", "touraz-dvdholic-2507bcb348dd.herokuapp.com" in t2)
print("old_gone:", old_url not in t2)
print("size:", os.path.getsize(src))
