# GitHub Actions - Compilar instaladores automaticamente

## Que hace

Cuando subes tu codigo a GitHub, **automaticamente** se generan los instaladores para:
- Windows (.exe)
- Mac (.dmg) -- sin necesidad de tener una Mac
- Linux (.AppImage y .deb)

Los instaladores quedan disponibles para descargar desde GitHub.

---

## Pre-requisitos (solo una vez)

### 1. Instalar Git

https://git-scm.com/downloads

Verificar:
```
git --version
```

### 2. Crear cuenta en GitHub

https://github.com/signup (gratis)

### 3. Crear repositorio en GitHub

1. En github.com, click "New repository"
2. Nombre: `casino-progresivo` (o el que quieras)
3. Privado o publico (si es privado, tienes 2000 min/mes gratis de Actions)
4. NO marques "Add README" ni nada (vacio)
5. Click "Create repository"

---

## Subir tu codigo a GitHub (primera vez)

Abrir terminal en la carpeta del proyecto:

```
git init
git add .
git commit -m "Primer commit"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/casino-progresivo.git
git push -u origin main
```

Reemplaza `TU-USUARIO` por tu usuario de GitHub.

---

## Como se generan los instaladores

### Opcion A - Cada vez que subes cambios (push a main)

```
git add .
git commit -m "Actualice colores"
git push
```

Va a GitHub > pestaña "Actions" > veras el workflow corriendo. Tarda 5-10 minutos.

Cuando termina, los instaladores estan disponibles como **Artifacts** (al final de la pagina del workflow). Descargables como .zip.

### Opcion B - Crear un Release oficial (recomendado para distribuir)

Cuando quieras publicar una version (ej. v1.0.0):

```
git tag v1.0.0
git push origin v1.0.0
```

Esto dispara el workflow Y crea un **Release** en la pestaña "Releases" de tu repo, con los 4 instaladores listos para descargar.

Para una nueva version:
```
git tag v1.0.1
git push origin v1.0.1
```

### Opcion C - Manual desde GitHub

1. GitHub > tu repo > pestaña "Actions"
2. Click en "Build Installers" (izquierda)
3. Click "Run workflow" (derecha) > "Run workflow"

---

## Como bajar los instaladores generados

### Desde Actions (artifacts temporales, expiran en 90 dias)

1. GitHub > tu repo > pestaña "Actions"
2. Click en el workflow exitoso (check verde)
3. Scroll abajo a "Artifacts"
4. Click para descargar `windows-installer.zip`, `mac-installer.zip`, `linux-installer.zip`

### Desde Releases (permanentes)

1. GitHub > tu repo > pestaña "Releases" (lado derecho)
2. Bajar directamente el `.exe`, `.dmg`, `.AppImage`, `.deb`

---

## Actualizar codigo (rutina normal)

```
git add .
git commit -m "Descripcion del cambio"
git push
```

GitHub Actions corre solo y compila.

---

## Costos

- **Repos publicos**: GRATIS, ilimitado
- **Repos privados**: 2000 minutos/mes gratis (Mac cuenta x10, Linux x1, Windows x2)
  - Un build completo gasta aprox: 8 min Linux + 10 min Windows + 12 min Mac = 142 min equivalentes
  - Te alcanza para ~14 builds privados por mes gratis

---

## Si algo falla

Ver el log del workflow en GitHub > Actions > click en el job rojo. Te muestra exactamente en que paso fallo.

Errores comunes:
- **"npm ci failed"**: actualiza el `package-lock.json` con `npm install` localmente y haz push
- **"icon.png not found"**: pon la imagen en `build/icon.png` o elimina las lineas `"icon"` del package.json
- **"sql.js error en build"**: paquetes nativos a veces fallan, agrega `npm rebuild` al workflow
