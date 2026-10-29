## Actualización 4.2 · Proyectos limpios, CSV y vista segura (GitHub Pages)

- **Ejemplo · 10 000 números primos** incluido como plantilla de muestra en nPrimos. Sus puntos se representan en Desmos en bloques de 500, conservando las aproximaciones y el análisis de valores. Desde **Proyectos → CSV** se descargan sus 10 000 pares `(n, p_n)`.
- **Nuevo proyecto** empieza en blanco: sin funciones, sin primos y sin hojas de cálculo. **Añadir números primos** es opcional.
- **Cambiar el nombre** desde el icono de lápiz de cada proyecto o pulsando su nombre.
- **Exportar CSV** disponible por proyecto (para proyectos vacíos, únicamente cabecera `x;y`), así como **Exportar JSON** para respaldar todos los proyectos. Las tablas CSV/XLSX importadas se vinculan al proyecto actual y se restauran al volver a abrirlo.
- **Ejemplo: agua saturada A-4** disponible en el importador CSV/Excel, elaborado a partir del XLSX suministrado (76 registros, 13 columnas, unidades conservadas). Selecciona `T (°C)` para X y `Psat (kPa)` para Y, o cualquier otro par numérico. La tabla se entrega en `assets/examples/agua_saturada_A4.csv`.
- **Viewport válido** al abrir proyectos: se normalizan estados previos de Desmos sin descartar fórmulas y se reencuadra después de cargar el panel para evitar la advertencia de viewport inválido.
- El aviso **Desmos Trial Key** corresponde a las condiciones de la API de Desmos; para producción necesitas una clave autorizada de Desmos. La app no oculta ni elimina ese aviso por medios no autorizados.

# Galarza Math Research 4.1 · Escritorio

Versión de escritorio **reconstruida desde los archivos web incluidos en el APK v4.0** de Galarza Math Research. Conserva los dos laboratorios originales (Mate-fx y nPrimos) y agrega importación de datos mediante CSV/XLSX para el graficador oficial de Desmos.

## Instalación · Windows, Linux o macOS

Se requiere **Node.js LTS + npm**. Descomprime el ZIP, abre una terminal en la carpeta y ejecuta:

```bash
npm install
npm start
```

En Windows también puedes iniciar `INICIAR_WINDOWS.bat`, que instala las dependencias si faltan. Esto ejecuta la aplicación de escritorio real con Electron; abrir `index.html` directamente no habilita la lectura de archivos Excel.

Para generar un ejecutable instalable (opcional):

```bash
npm run build:win
# o: npm run build:linux / npm run build:mac
```

> `npm run build:win` está pensado para Windows, `build:mac` para macOS, etc. No se adjuntan binarios precompilados; la compilación requiere conectividad para descargar dependencias y componentes de Electron.

## Dos espacios de investigación recuperados

- **Mate-fx:** función de números naturales ℕ → ℝ, geometría de segmentos, curvas y ángulos; utiliza el motor geométrico local original o el graficador API de Desmos.
- **nPrimos:** estudio de hasta 10 000 primos, aproximaciones, proyectos independientes, tablas y funciones, con el motor local de respaldo de la app Android original.

## Datos de Excel y CSV

1. Abre Mate-fx o nPrimos y pulsa **Datos CSV / Excel**.
2. Selecciona un archivo `.csv` o `.xlsx`. En escritorio se admiten hasta **20 MB**, 50 columnas y 10 000 filas de datos por importación.
3. Revisa la vista previa. Selecciona la columna de interés para el eje X y para el eje Y. Si solo hay una columna numérica, puedes usar el número de fila como eje X.
4. Selecciona **Solo puntos** o **Puntos y líneas** y pulsa **Graficar en Desmos**. La herramienta crea una tabla editable dentro del graficador oficial de Desmos (no solo una imagen).
5. Usa **Encuadrar puntos** si quieres ajustar el plano. Los datos también pueden exportarse a JSON.

El CSV acepta coma, punto y coma, tabulador y comillas escapadas; los datos numéricos decimales con coma se interpretan también. Las filas con datos faltantes o no numéricos en alguno de los ejes se omiten.

## Desmos: clave y disponibilidad

La API oficial se carga desde `desmos.com` al iniciar el motor Desmos, por lo que **requiere conexión a Internet**. Como la app procede de una versión de prueba, por defecto se conserva la clave de demostración de Desmos exclusivamente para desarrollo. Antes de distribuir la aplicación debes conseguir tu clave personal en [desmos.com/my-api](https://www.desmos.com/my-api), abrir **Datos CSV / Excel**, guardarla en **Clave personal de Desmos** y reiniciar la aplicación. La clave se guarda localmente en el perfil de la aplicación.

Desmos tiene sus propias condiciones y planes para usos comerciales. No se incluye su código propietario, ni se afirma que la aplicación funcione con la API oficial sin conexión. Cuando Desmos no está disponible, permanecen las herramientas de geometría y primos locales, y la vista previa de datos sigue funcionando.

## Python (opcional)

Además del programa Electron, hay una herramienta independiente para regresión lineal, correlación de Pearson y R² sobre los datos:

```bash
python analysis/analyze.py examples/mediciones.csv --x "Tiempo (s)" --y "Temperatura (C)"
```

Solo se usa la biblioteca estándar de Python para CSV; para XLSX se puede instalar `openpyxl` (`pip install openpyxl`).

## Estructura

- `assets/` — HTML, CSS, JS y fuente MathLive extraídos del APK, más controles de escritorio en `assets/desktop/`.
- `desktop/main.cjs` — proceso principal Electron y servidor HTTP local limitado a los recursos de la app.
- `desktop/preload.cjs` — puente aislado para abrir/exportar archivos sin exponer Node.js al graficador.
- `desktop/data-service.cjs` — CSV robusto y lectura de XLSX mediante ExcelJS.
- `analysis/analyze.py` — análisis estadístico opcional.
- `tests/` — pruebas automáticas básicas (`npm test`).

### Alcance y estado de prueba

Se han verificado el contenido del APK y las pruebas de lectura CSV. **No se ha compilado ni instalado un EXE en esta sesión**, así que esta entrega es el proyecto fuente listo para instalar dependencias y ejecutar, no un binario Windows certificado. El código recuperado del APK se mantiene sin autorización para sublicenciar a terceros; revisa derechos de los materiales integrados antes de distribuir públicamente.

## Publicación en GitHub Pages

El repositorio incluye `index.html` en su raíz y `.github/workflows/pages.yml`, que publica solamente los recursos web de `assets/` (sin Electron, npm, Python ni datos privados). El sitio está previsto para `https://magalarza726-del.github.io/Mate-fx/`.

Si es la primera vez que habilitas Pages: abre **GitHub → Mate-fx → Settings → Pages → Build and deployment → Source → GitHub Actions**. Se ejecuta el flujo al subir cambios a `main`; también puedes lanzarlo desde Actions.

En GitHub Pages puedes subir archivos **CSV y XLSX**, elegir las columnas X/Y y representar puntos mediante la API oficial de Desmos. El XLSX se interpreta **en el navegador** con ExcelJS 4.4.0 servido desde CDN; el fichero no se envía a nuestro servidor. Desmos y la carga del lector XLSX requieren conexión. El análisis local de las dos interfaces se mantiene.


## Actualización 4.3 · Tabla de investigación

En **nPrimos**, las tablas de datos (incluidos los 10 000 primos del ejemplo y las series CSV/XLSX) se grafican como expresiones `secret`, para que el editor izquierdo muestre únicamente funciones, sin ocultar los puntos del plano. El botón rojo **Ver tabla** aparece sobre el botón azul **Datos CSV / Excel**.

- Tablas vinculadas a los datos importados y a las columnas X/Y elegidas (encabezados originales preservados).
- Cada función definida como `f(x)`, `g(x)`, `f_{1}(x)`, etc. se identifica por su nombre. Las expresiones nuevas sin nombre se convierten a `f_{i}(x)=...` cuando el usuario termina de escribir.
- **Error en Y:** `E=|f_i(X)-Y|`. **Error en X:** se resuelve numéricamente `f_i(X_estimado)=Y` y `E=|X_estimado-X|`, eligiendo la solución cercana al dato si existen varias. Los resultados que no pueden calcularse se muestran como `—`.
- **Error porcentual:** `%E=100·E/|valor real|`, con exactamente tres decimales. Si el valor real vale cero, el porcentaje es indefinido y se muestra `—`.
- Ordenar al pulsar las cabeceras, mover columnas mediante ‹ › o arrastrando, filtros mínimos y máximos por columna, 50–1000 filas por página y exportación CSV del análisis filtrado y ordenado.
- Análisis local sin ejecutar código dinámico del usuario. Se reconocen las expresiones que admite el parser matemático seguro de Mate-fx. Las expresiones muy avanzadas de Desmos no se evalúan falsamente: muestran `—` con un aviso.

Pruebas: `node tests/analysis-core.test.mjs`.