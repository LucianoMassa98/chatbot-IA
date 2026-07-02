import os
import re
import base64
import requests
import subprocess

# Target files and folders
brain_dir = r"c:\Users\lgmas\.gemini\antigravity-ide\brain\636e6d47-0c29-4d4d-813b-52ffd64a3a58"
input_md_path = os.path.join(brain_dir, "chatbot_flow_diagrams.md")
temp_md_path = os.path.join(brain_dir, "chatbot_flow_diagrams_temp.md")
style_css_path = os.path.join(brain_dir, "style.css")
output_pdf_path = os.path.join(brain_dir, "chatbot_flow_diagrams.pdf")

print("Checking source markdown file:", input_md_path)
if not os.path.exists(input_md_path):
    print("Error: Source file does not exist.")
    exit(1)

with open(input_md_path, "r", encoding="utf-8") as f:
    content = f.read()

# Regular expression to find mermaid blocks
pattern = re.compile(r"```mermaid\s*(.*?)\s*```", re.DOTALL)
matches = pattern.findall(content)
print(f"Found {len(matches)} mermaid diagrams.")

# Function to get URL-safe base64 of mermaid code
def get_mermaid_url(mermaid_code):
    graph_bytes = mermaid_code.encode("utf8")
    base64_bytes = base64.urlsafe_b64encode(graph_bytes)
    base64_string = base64_bytes.decode("ascii").replace("=", "")
    return f"https://mermaid.ink/img/{base64_string}"

# Downloader
downloaded_images = []
for i, diagram_code in enumerate(matches, 1):
    print(f"Processing diagram {i}...")
    url = get_mermaid_url(diagram_code)
    
    # Download PNG
    response = requests.get(url)
    if response.status_code == 200:
        image_filename = f"diagram_{i}.png"
        image_path = os.path.join(brain_dir, image_filename)
        with open(image_path, "wb") as img_file:
            img_file.write(response.content)
        print(f"Saved {image_filename} successfully.")
        downloaded_images.append(image_path)
    else:
        print(f"Failed to download diagram {i}. Status code: {response.status_code}")

# Substitute mermaid blocks in temp markdown
def replacement_handler(match):
    global idx
    idx += 1
    image_filename = f"diagram_{idx}.png"
    image_path = os.path.join(brain_dir, image_filename)
    if os.path.exists(image_path):
        # We can use standard relative path since md-to-pdf runs in context of base directory or absolute path
        # Using relative image name is cleanest if they are in the same folder,
        # but let's use the absolute path in file:/// format for maximum robustness
        file_url = f"file:///{image_path.replace(os.sep, '/')}"
    else:
        code = match.group(1)
        file_url = get_mermaid_url(code)
    return f"![Diagrama {idx}]({file_url})"

idx = 0
new_content = pattern.sub(replacement_handler, content)

# Write modified markdown
with open(temp_md_path, "w", encoding="utf-8") as f:
    f.write(new_content)
print("Saved temporary markdown with image references.")

# CSS content for beautiful design
css_content = """@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');

body {
  font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: #1e293b;
  line-height: 1.6;
  font-size: 15px;
  background-color: #ffffff;
  padding: 0;
}

h1 {
  font-size: 32px;
  color: #0f172a;
  border-bottom: 2px solid #e2e8f0;
  padding-bottom: 16px;
  margin-top: 0;
  margin-bottom: 32px;
  font-weight: 700;
  text-align: center;
}

h2 {
  font-size: 22px;
  color: #0f172a;
  margin-top: 36px;
  margin-bottom: 16px;
  border-bottom: 1px solid #f1f5f9;
  padding-bottom: 8px;
  page-break-before: always;
  font-weight: 600;
}

h2:first-of-type {
  page-break-before: avoid;
}

p {
  margin-bottom: 20px;
  font-weight: 300;
  color: #475569;
}

img {
  display: block;
  margin: 30px auto;
  max-width: 90%;
  max-height: 400px; /* limit height so it fits on a single page */
  height: auto;
  border-radius: 12px;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -4px rgba(0, 0, 0, 0.05);
  border: 1px solid #f1f5f9;
  padding: 20px;
  background-color: #f8fafc;
  page-break-inside: avoid;
}

hr {
  border: 0;
  height: 1px;
  background: #f1f5f9;
  margin: 40px 0;
}

code {
  font-family: 'Courier New', Courier, monospace;
  background-color: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.9em;
}

pre {
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
  overflow-x: auto;
  margin-bottom: 24px;
  page-break-inside: avoid;
}

pre code {
  background-color: transparent;
  padding: 0;
  border-radius: 0;
  font-size: 0.85em;
  color: #334155;
}
"""

with open(style_css_path, "w", encoding="utf-8") as f:
    f.write(css_content)
print("Saved custom CSS stylesheet.")

# Command to run md-to-pdf via npx
pdf_options = '{"format": "A4", "margin": {"top": "25mm", "bottom": "25mm", "left": "25mm", "right": "25mm"}}'
cmd = [
    "npx", "md-to-pdf", 
    temp_md_path, 
    "--stylesheet", style_css_path, 
    "--pdf-options", pdf_options
]

print("Running command:", " ".join(cmd))
result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
print("STDOUT:", result.stdout)
print("STDERR:", result.stderr)

# The output PDF generated by md-to-pdf will be named chatbot_flow_diagrams_temp.pdf in brain_dir
generated_temp_pdf = os.path.join(brain_dir, "chatbot_flow_diagrams_temp.pdf")
if os.path.exists(generated_temp_pdf):
    # Rename/move to output_pdf_path
    if os.path.exists(output_pdf_path):
        os.remove(output_pdf_path)
    os.rename(generated_temp_pdf, output_pdf_path)
    print(f"Success! Output PDF generated at: {output_pdf_path}")
else:
    print("Error: PDF generation failed.")

# Cleanup temporary files
print("Cleaning up temporary files...")
if os.path.exists(temp_md_path):
    os.remove(temp_md_path)
if os.path.exists(style_css_path):
    os.remove(style_css_path)
for img in downloaded_images:
    if os.path.exists(img):
        os.remove(img)

print("Done!")
