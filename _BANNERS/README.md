# Banners de vídeo

Aquí van los vídeos cortos en bucle (~5 seg) que se intercalan en la home
entre los proyectos. Son decorativos: **no se puede clicar**, no enlazan a
nada.

## Cómo añadir un banner

1. Mete el archivo de vídeo en esta carpeta (ej. `loop1.webm`).
2. En `data.json`, dentro del array `projects`, añade un objeto con la
   clave `banner` apuntando al nombre del archivo:
   ```json
   { "banner": "loop1.webm" }
   ```
   El banner aparece en la home en la posición que ocupe en el array
   (entre el proyecto anterior y el siguiente).

## Formatos recomendados

- **Aspect ratio:** 3:1 (mismo que los strips de proyecto, ej. 2000×667).
- **Formato preferido:** `webm` (peso pequeño, soporte nativo en navegadores modernos).
- **Otros aceptados:** `mp4`, `mov`.
- **Duración:** corta (~5 seg). El vídeo se reproduce en bucle automáticamente, muteado.
- **Peso:** intentar < 1 MB para no penalizar la carga de la home.
