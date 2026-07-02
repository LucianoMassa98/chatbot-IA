import base64
import requests

code = """graph TD
    A["Mensaje de WhatsApp Recibido"] --> B["Normalizar Mensaje"]
    B --> C["¿El Usuario ya existe?"]
    C -- "No" --> D["Crear Registro de Usuario en BD"]
    C -- "Sí" --> E["Cargar datos de Usuario y Sesión"]
    D --> F["Enviar Bienvenida y Activar Flujo de Menú"]
    E --> G["¿Usuario Registrado? (Tiene nombre y dirección/mapa)"]
    G -- "No" --> H["Forzar Flujo de Menú (Sección Registro)"]
    G -- "Sí" --> I["¿El mensaje coincide con alguna palabra clave de flujo?"]
    I -- "Sí (Ej: 'comprar')" --> J["Iniciar Flujo Específico (compra, suscripcion, etc.)"]
    I -- "No" --> K["Iniciar Flujo de Menú (Step 0: Mostrar Menú Principal)"]
    H --> L["Preguntar Nombre o Dirección"]"""

def get_mermaid_url(mermaid_code):
    # Encode standard UTF-8 string to bytes
    graph_bytes = mermaid_code.encode("utf8")
    # Base64 urlsafe encode
    base64_bytes = base64.urlsafe_b64encode(graph_bytes)
    # Convert to string and remove trailing padding characters
    base64_string = base64_bytes.decode("ascii").replace("=", "")
    return f"https://mermaid.ink/img/{base64_string}"

url = get_mermaid_url(code)
print("URL:", url)
response = requests.get(url)
print("Status Code:", response.status_code)
if response.status_code == 200:
    print("Content length:", len(response.content))
    with open("test_out.png", "wb") as f:
        f.write(response.content)
    print("Saved test_out.png successfully.")
else:
    print("Error content:", response.text)
