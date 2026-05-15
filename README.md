# Herramientas para optimizar el dashboard

## 1. Generar sprite-sheets de moto y auto F1

Los modelos 3D consumen mucha GPU. La idea es pregenerar 36 frames del modelo rotando
y guardarlos como UN solo PNG (sprite-sheet). Después el dashboard solo necesita mostrar
una imagen y cambiar el frame visible — costo casi 0% CPU/GPU.

### Cómo usar

1. Copia `generador-sprites.html` a la carpeta donde tienes `moto.glb` y `f1.glb`
2. Abre la carpeta con un servidor HTTP (necesario por CORS de Three.js):
   - Opción A: con Node.js → `npx serve`
   - Opción B: con Python → `python -m http.server`
   - Opción C: con VS Code → extension "Live Server"
3. Abre `http://localhost:3000/generador-sprites.html` (o el puerto que use)
4. Click en "Generar moto" → se descarga `moto_sprite.png`
5. Click en "Generar auto F1" → se descarga `auto_sprite.png` (puede tardar ~30 seg)
6. Copia los PNG a la carpeta de tu Electron

### Resultado
- `moto_sprite.png`: imagen de 1440x1440 con 36 frames de la moto rotando
- `auto_sprite.png`: igual pero del auto F1
- Cada frame: 240x240 px, grid 6x6

## 2. Comprimir videos MP4 a WebM (50-70% más liviano)

WebM con codec VP9 es más eficiente que MP4 H.264. Mismo video, mucho menos peso y CPU.

### Requisito: instalar FFmpeg
- **Windows**: descargar de https://ffmpeg.org/download.html y agregar a PATH
- **Mac**: `brew install ffmpeg`
- **Linux**: `sudo apt install ffmpeg`

### Cómo usar

1. Copia el script (`.bat` para Windows, `.sh` para Mac/Linux) a la carpeta de los videos
2. Ejecutar:
   - Windows: doble click en `comprimir-videos.bat`
   - Mac/Linux: `./comprimir-videos.sh`
3. Esperar 5-10 minutos (depende del peso de los originales)
4. Se generan: `background-mini.webm`, `background-minor.webm`, etc.

### Después, en el HTML del dashboard
Cambiar:
```html
<source src="background-mini.mp4" type="video/mp4">
```
Por:
```html
<source src="background-mini.webm" type="video/webm">
<source src="background-mini.mp4" type="video/mp4">  <!-- fallback -->
```
