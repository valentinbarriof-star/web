# Cómo mantener valentinbarrio.com

Guía paso a paso para añadir, modificar o borrar contenido de la web sin tocar código.

**Regla de oro:** todo se hace en **`data.json`** y archivos dentro de **`_PROJECTS/`**. El código (`index.html`, `css/style.css`, `js/main.js`, `404.html`) no hay que tocarlo nunca.

---

## ⚠️ LÉEME PRIMERO

### Qué tocar y qué NO tocar
- ✅ **Sí puedes tocar:** `data.json`, los archivos dentro de `_PROJECTS/` (imágenes y audios)
- ❌ **Mejor no toques:** `index.html`, `404.html`, `css/style.css`, `js/main.js` (si no sabes qué haces, se rompe)
- Si tocas algo por error, **no guardes**, cierra sin guardar y vuelve a abrir

### La web necesita un servidor para funcionar en local
No sirve abrir `index.html` con doble click. Hay que servirla:
```bash
python3 -m http.server 8090
# luego abrir http://localhost:8090
```
(Solo para probar en tu ordenador. En GitHub Pages funciona automático.)

### Formatos
- **Imágenes:** siempre `.webp`. Ancho recomendado 1200–2000 px, peso ideal < 400 KB.
- **Audios:** `.opus` o `.mp3`. Lo que tengas a mano.
- **Nombre de archivos:** numerados `1.webp`, `2.webp`, `3.webp`… sin saltos.

### Caché del navegador
Si cambias algo y al abrir la web sigues viendo lo viejo: es la caché.
**Refrescar con Ctrl+F5** (Windows) o **Cmd+Shift+R** (Mac).

---

## Cómo subir los cambios al sitio real

Todo lo que edites en este repo se sube a la web con 3 pasos en GitHub:

### Desde la web de GitHub (lo más fácil)
1. Entra a https://github.com/meowrhino/valentin3
2. Click en el archivo que quieres editar (ej. `data.json`) → botón lápiz ✏️
3. Edita, y al final de la página pulsa **Commit changes**

### Subir archivos nuevos (imágenes, audios)
1. Entra a la carpeta donde va (ej. `_PROJECTS/bolder/`)
2. Pulsa **Add file → Upload files**
3. Arrastra el archivo y pulsa **Commit changes**

En pocos minutos GitHub Pages refresca la web automáticamente.

> Si usas VS Code o cualquier editor con git: `git add -A && git commit -m "update" && git push`

---

## Estructura del repo

```
valentin3/
├── index.html          ← shell de la página (no tocar)
├── 404.html            ← mismo shell para URLs profundas (no tocar)
├── data.json           ← ⭐ la configuración de toda la web
├── css/
│   └── style.css       ← estilos (no tocar)
├── js/
│   └── main.js         ← lógica SPA (no tocar)
├── fonts/              ← fuente Outfit local (no tocar)
├── _PROJECTS/          ← ⭐ los archivos de cada proyecto
│   ├── _valentin/      ← el "about", es un proyecto más (oculto en la home)
│   ├── bolder/
│   ├── brunch/
│   └── …
├── _BANNERS/           ← vídeos decorativos opcionales (ver más abajo)
└── README.md           ← este archivo
```

---

## Cómo funciona la web, en 30 segundos

- **Home** (`/`): cabecera (con el nombre clickable que lleva al about) + lista de tiras (una por proyecto visible). Al llegar al final se siguen generando aleatoriamente (infinite scroll).
- **Proyecto** (`/bolder`, `/lynn`, etc.): margen superior con un punto, ficha técnica + descripción, galería vertical de imágenes (con textos y audios intercalados si los hay), margen inferior con otro punto, y botón **back to home** al final.
- **About** (`/_valentin`): es un proyecto más con `visible: false`, así que NO aparece en la lista de tiras de la home — se accede clicando el nombre en la cabecera. La identidad del proyecto-about la marca `meta.about_slug` en `data.json`.
- **Transición**: al clicar una tira se abre un círculo negro desde el punto, cubre todo, y al llegar a la nueva página se abre otro círculo que la descubre desde el centro. Al volver, el círculo que descubre se abre desde el punto de la tira del proyecto que acabas de ver.
- **Lightbox**: al clicar una foto del proyecto se amplía en pantalla completa. Se cierra con ESC, click fuera, o las X de las esquinas. Flechas ← → para ir a la anterior/siguiente.

---

## PROYECTOS (lo que más vas a tocar)

Cada proyecto necesita **una carpeta en `_PROJECTS/`** con sus imágenes **y una entrada en `data.json`** dentro del array `projects`.

### ➕ Añadir un proyecto nuevo

Imagina que se llama **"Mi Proyecto"** y su identificador (slug) va a ser **`mi-proyecto`** (sin espacios, sin tildes, minúsculas, solo letras, números y guiones).

**1. Crea la carpeta y sube las fotos:**
```
_PROJECTS/mi-proyecto/
├── 1.webp
├── 2.webp
├── 3.webp
└── …
```
Las imágenes deben estar numeradas de forma consecutiva empezando en 1. **No hace falta decir cuántas hay**: la web sondea automáticamente hasta encontrar el primer hueco.

**2. Añade el proyecto a `data.json`** dentro del array `projects`:
```json
{
  "slug": "mi-proyecto",
  "nombre": "Mi Proyecto",
  "visible": true,
  "tipo": "festival",
  "lugar": "Barcelona",
  "fecha": "may. 26",
  "descripcion": "Lo que quieras contar del proyecto."
}
```
No te olvides de la coma al final del proyecto anterior.

| Campo | Qué es |
|---|---|
| `slug` | Identificador interno. **Debe coincidir con el nombre de la carpeta en `_PROJECTS/`**. Solo minúsculas, números y guiones. |
| `nombre` | Título visible en el proyecto y en la pestaña del navegador |
| `visible` | `true` → aparece en la home. `false` → no aparece en la home pero la URL `/<slug>` sigue accesible (útil para mandar el link a alguien antes de "publicar"). Si no pones el campo, se considera `true`. |
| `tipo` | Tipo de trabajo: `press`, `club`, `festival`, etc. Aparece en la ficha técnica |
| `lugar` | Dónde se hizo. Aparece en la ficha |
| `fecha` | Cuándo se hizo. Aparece en la ficha |
| `descripcion` | Texto bajo el título del proyecto |
| `portadaExt` | (opcional) Extensión del archivo de portada si NO es `webm`. Ver sección PORTADA |
| `equipo` | (opcional) Array de colaboradores. Ver sección EQUIPO |
| `extras` | (opcional) Textos / audios intercalados en la galería. Ver sección EXTRAS |

> **Campos vacíos = se omiten del render.** Si un proyecto todavía no tiene `tipo`, `lugar`, `fecha` o `descripcion`, simplemente **no pongas el campo**. La sección correspondiente desaparece. La ficha técnica también desaparece entera si todos sus campos están vacíos.

> **Olvidate de `imgHome` e `imgCount`** — ya no existen. La portada del strip de la home se busca como `_PROJECTS/<slug>/portada.webm` (ver siguiente sección) y la galería se descubre sola.

### ✏️ Modificar un proyecto
Abre `data.json`, busca el proyecto, edita los campos que quieras. Si cambias el `slug`, **renombra también la carpeta** en `_PROJECTS/` para que coincida.

### ❌ Borrar un proyecto
1. Borra su entrada del array `projects` en `data.json` (ojo con las comas).
2. Borra la carpeta correspondiente de `_PROJECTS/`.

### 🙈 Ocultar un proyecto sin borrarlo
Pon `"visible": false` en su entrada. Desaparece de la home pero `valentinbarrio.com/<slug>` sigue funcionando para quien tenga el link.

### 🔄 Cambiar el orden de los proyectos
El orden en la home es el mismo que en el array `projects` de `data.json`. Mueve los objetos para reordenar.

> El `_valentin` (about) está oculto (`visible: false`), no aparece en las tiras. El acceso es clicando el nombre en la cabecera de la home.

### 🎞️ Banners de vídeo intercalados

Si quieres meter un loop de vídeo decorativo entre proyectos (no clickable, ~5 seg):

1. Mete el vídeo en `_BANNERS/` (carpeta nueva en la raíz). Formato recomendado: `webm` 3:1, < 1 MB.
2. En `data.json`, dentro del array `projects`, añade un objeto con la clave `banner` en la posición donde quieras que aparezca:
   ```json
   "projects": [
     { "slug": "lynn", "nombre": "Lynn", "visible": true, ... },
     { "banner": "loop1.webm" },
     { "slug": "yu", "nombre": "Yu", "visible": true, ... },
     …
   ]
   ```

> Los banners **solo aparecen en la pasada inicial**, no en el scroll infinito (el aleatorio solo recicla proyectos clickables). Más detalles en `_BANNERS/README.md`.

---

## PORTADA del strip de la home

Cada proyecto necesita una **portada dedicada** dentro de su carpeta:
```
_PROJECTS/mi-proyecto/
├── portada.webm     ← esta es la portada del strip de la home (vídeo en bucle)
├── 1.webp           ← galería del proyecto
├── 2.webp
└── …
```

- **Por defecto la web busca `portada.webm`** (vídeo en bucle, automuteado, 3:1).
- **Si quieres usar otro formato**, añade el campo `portadaExt` al proyecto en `data.json`:
  ```json
  { "slug": "lynn", "nombre": "Lynn", …, "portadaExt": "webp" }
  ```
  Extensiones soportadas: `webm`, `mp4`, `mov` (vídeo) o `webp`, `jpg`, `png` (imagen).
- **Formato recomendado:** `webm` con aspect ratio **3:1** (ej. 2000×667 px), peso < 1 MB.
- **El archivo se llama siempre `portada`** + la extensión que toque (`portada.webm`, `portada.webp`, etc.).

> Si un proyecto no tiene `portada.<ext>`, el strip queda transparente (sin imagen, pero el hover sigue funcionando). Si está oculto (`visible: false`) tampoco aparece en la home, así que no pasa nada.

---

## EXTRAS: textos y audios intercalados en la galería

La galería del proyecto siempre se rellena automáticamente con las imágenes numeradas (`1.webp`, `2.webp`, …) que haya en la carpeta. Si quieres **meter una cita o una nota de voz entre dos imágenes concretas**, añade un campo `extras` con un array de objetos:

```json
{
  "slug": "ejemplo",
  "nombre": "Ejemplo",
  "visible": true,
  "tipo": "press",
  "lugar": "Barcelona",
  "fecha": "feb. 26",
  "descripcion": "…",
  "extras": [
    { "tipo": "texto", "texto": "Una cita al principio.", "posicion": 0 },
    { "tipo": "audio", "src": "nota-de-voz.opus", "posicion": 3 },
    { "tipo": "texto", "texto": "Otra cita más abajo.", "posicion": 7 }
  ]
}
```

| Campo | Qué es |
|---|---|
| `tipo` | `"texto"` o `"audio"` |
| `texto` | (solo si tipo `texto`) la frase a mostrar (aparece centrada, en cursiva) |
| `src` | (solo si tipo `audio`) nombre del archivo dentro de la carpeta del proyecto |
| `posicion` | número entero. **`0` = antes de la primera imagen**, **`N` = justo después de la N-ésima imagen**. Si pones varios extras con la misma posición, salen en el orden del array. |

> Tu galería sigue ordenándose por número de archivo (`1.webp`, `2.webp`…). Si quieres reordenar, **renombras los archivos**. Los extras solo intercalan; no cambian el orden de las imágenes.

---

## EQUIPO / CRÉDITOS

Si un proyecto tuvo colaboradores, añade un array `equipo` al objeto del proyecto:

```json
"equipo": [
  { "nombre": "Rivka",  "rol": "photo assist & 2nd camera", "url": "https://instagram.com/rivka" },
  { "nombre": "Juanjo", "rol": "styling" }
]
```

Cada entrada aparece en la ficha técnica.

| Campo | Qué es |
|---|---|
| `nombre` | Nombre que se muestra (obligatorio; si falta, la entrada se ignora) |
| `rol` | Rol del colaborador. Si lo dejas vacío, se muestra como "team" |
| `url` | (opcional) Enlace asociado al nombre. Si lo añades, el nombre se vuelve clickable y abre la URL en una pestaña nueva |

---

## ABOUT (`_valentin`)

El about es **un proyecto más** dentro del array `projects`, identificado por `meta.about_slug`. Tiene `"visible": false` para que no salga en las tiras de la home, y se accede clicando el nombre en la cabecera.

Soporta todo lo de un proyecto normal (ficha, galería auto-descubierta, `extras` para intercalar texto/audio, equipo) y además un campo extra `web`:

```json
{
  "slug": "_valentin",
  "nombre": "about me",
  "visible": false,
  "tipo": "",
  "lugar": "",
  "web": "meowrhino.studio",
  "descripcion": "Photographer and visual artist based in Barcelona…",
  "extras": [ … ]
}
```

### Campo `web` (link "web: …" debajo de "back to home")
Si un proyecto trae `web`, debajo del botón **back to home** aparece un link pequeño y centrado tipo `web: meowrhino.studio` que abre esa URL en pestaña nueva. Pensado para el about (créditos del estudio que hizo la web), pero técnicamente funciona en cualquier proyecto que añada el campo.

### ✏️ Cambiar el about
Edita la entrada `_valentin` dentro de `projects` en `data.json`. Si quieres cambiar el slug, cambia también `meta.about_slug` y **renombra la carpeta** `_PROJECTS/_valentin/` para que coincida.

> El slug `_valentin` empieza por `_` aposta, para distinguirlo del resto.

---

## CABECERA DE LA HOME (nombre, tagline, email, instagram)

Se edita en `data.json` → `meta`:
```json
"meta": {
  "nombre": "valentin barrio",
  "about_slug": "_valentin",
  "tagline": "creative based in europe",
  "email": "valentinbarrio@gmail.com",
  "instagram": "valentinbarrio"
}
```

| Campo | Qué es |
|---|---|
| `nombre` | Aparece grande en la cabecera. Si `about_slug` está definido, además se vuelve clickable y enlaza al about |
| `about_slug` | Slug del proyecto que actúa como about. Normalmente `"_valentin"`. Si lo dejas vacío, el nombre deja de ser un link |
| `tagline` | Subtítulo bajo el nombre |
| `email` | Aparece como link `mailto:`. Si lo dejas vacío, no aparece |
| `instagram` | Solo el handle, sin `@` ni URL. El sitio lo enlaza a `instagram.com/<handle>`. Si lo dejas vacío, no aparece |

---

## FAVICON

El iconito de la pestaña del navegador es un **SVG inline** dentro del propio HTML — no hay archivo aparte. Replica el favicon de la versión personal de la web antigua: un círculo con punto central (◉).

Se define en el `<link rel="icon">` de `index.html` y `404.html` (línea 18 de cada uno). Para cambiarlo edita ese atributo `href` en los **dos archivos** (debe ser idéntico). Si te lías, mejor avisa antes de tocar — está pensado para no necesitar mantenimiento.

---

## ⚠️ Errores comunes

| Síntoma | Causa probable |
|---|---|
| La web no carga nada | Error de sintaxis en `data.json` — una coma de más, una comilla sin cerrar. Valida con https://jsonlint.com |
| Una imagen no se ve | El `slug` del proyecto no coincide con el nombre de la carpeta, o falta el archivo numerado (`3.webp`). Recuerda que la numeración tiene que ser consecutiva: si te saltas un número (`1.webp`, `2.webp`, falta el `3.webp`, `4.webp`), la web para de buscar en el hueco y no verás `4.webp` ni siguientes. |
| La portada del proyecto en la home no es la que quiero | Reemplaza `_PROJECTS/<slug>/portada.webm` (o el archivo de portada que esté usando — `portada.webp`, `portada.mp4`, etc.) manteniendo el mismo nombre. |
| El audio no suena | El `src` del bloque no coincide con el nombre exacto del archivo dentro de la carpeta del proyecto. Atento a mayúsculas/minúsculas y espacios. |
| Los cambios no se ven | Caché del navegador. Ctrl+F5 (Windows) o Cmd+Shift+R (Mac). |
| Al entrar directamente a `/bolder` da 404 | Solo en local con `python3 -m http.server`. En GitHub Pages sí funciona gracias a `404.html`. |

---

## Verificar que todo funciona

Abre la web y la consola del navegador (F12 o Cmd+Opt+I):
- No debería haber errores en rojo
- Si falta algún archivo, aparece un warning con la ruta exacta

---

## Ante cualquier duda

Guarda copia de `data.json` antes de hacer cambios grandes. Si algo se rompe, restaurándolo vuelve todo a estar OK.

La web la hizo **manu (@meowrhino)**. Si algo se rompe y no sabes arreglarlo, contacta.
