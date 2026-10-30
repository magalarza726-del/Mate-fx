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

En **nPrimos**, las tablas de datos (incluidos los 10 000 primos del ejemplo y las series CSV/XLSX) se grafican como listas de puntos mediante expresiones `secret`, para que el editor izquierdo muestre únicamente funciones, sin ocultar los puntos del plano. El botón rojo **Ver tabla** aparece sobre el botón azul **Datos CSV / Excel**.

- Tablas vinculadas a los datos importados y a las columnas X/Y elegidas (encabezados originales preservados).
- Cada función definida como `f(x)`, `g(x)`, `f_{1}(x)`, etc. se identifica por su nombre. Las expresiones nuevas sin nombre se convierten a `f_{i}(x)=...` cuando el usuario termina de escribir.
- **Error en Y:** `E=|f_i(X)-Y|`. **Error en X:** se resuelve numéricamente `f_i(X_estimado)=Y` y `E=|X_estimado-X|`, eligiendo la solución cercana al dato si existen varias. Los resultados que no pueden calcularse se muestran como `—`.
- **Error porcentual:** `%E=100·E/|valor real|`, con exactamente tres decimales. Si el valor real vale cero, el porcentaje es indefinido y se muestra `—`.
- Ordenar al pulsar las cabeceras, mover columnas mediante ‹ › o arrastrando, filtros mínimos y máximos por columna, 50–1000 filas por página y exportación CSV del análisis filtrado y ordenado.
- Análisis local sin ejecutar código dinámico del usuario. Se reconocen las expresiones que admite el parser matemático seguro de Mate-fx. Las expresiones muy avanzadas de Desmos no se evalúan falsamente: muestran `—` con un aviso.

Pruebas: `node tests/analysis-core.test.mjs`.


## Actualización 4.5 · Dash Boards y generador de funciones

En **nPrimos**, sobre el botón rojo de la tabla aparecen dos herramientas:

- **Ver Dash Boards (amarillo)**: comparar columnas X/Y observadas, cada `fᵢ(x)` calculada, su error absoluto `E` y `%E`. Las series se seleccionan por casillas; admite gráfico de líneas/dispersión, eje X seleccionable (X, Y, índice), normalización individual 0–100 %, recorte por valores del eje horizontal y exportación PNG. Se alimenta de las mismas columnas y fórmulas que la tabla de investigación.
- **Generador de funciones (verde)**: crear hasta `n` estructuras de función mediante búsqueda aleatoria y aprendizaje generacional opcional (selección/mutación de mejores candidatas), con pausa, reanudación y parada. Los coeficientes se ajustan por mínimos cuadrados; se clasifica por MAPE global en Y. Porcentajes no definidos (Y=0) se excluyen y funciones fuera del dominio se descartan.
- **Restricciones del generador**: 1–3 términos `hᵢ(x)`; cada uno usa como máximo 1 o 2 `x` (configurable), y constante `+c` opcional. Incluye términos `x`, `x^p`, `ln(x)`, `sqrt(x)`, `e^(kx)`, `sin(kx)`, `x ln(x)`, `x^x`, `x e^(kx)`, etc. Se combinan sin `eval` ni ejecución de código libre.
- **Tramos configurables**: edición de rangos X mínimo/máximo y MAPE por tramo; cada resultado conserva los rangos usados. Cada función válida se almacena por proyecto mediante IndexedDB y el historial completo puede exportarse a CSV. Se pueden enviar funciones elegidas a Desmos como `f₁(x)`, `f₂(x)`, etc.
- **Operación**: la generación corre en Web Worker para mantener la interfaz utilizable; los lotes ceden control para procesar pausa y reanudación. La persistencia de historial no implica ejecución en segundo plano después de cerrar la pestaña. Desmos requiere internet, pero las evaluaciones del generador son locales.

Pruebas: `node --test tests/analysis-core.test.mjs tests/expression-registry.test.mjs tests/generator-core.test.mjs`. La prueba de interfaz aislada es `python tests/research-inline-browser-test.py` (requiere Playwright y Chromium).

**Precisión del historial:** el ajuste utiliza una muestra representativa de hasta 350 filas para mantener rápidas las iteraciones, pero el MAPE global y por tramos se evalúa sobre **todas las filas importadas**; la media registrada no se basa en una muestra.


## Mate-fx 4.7: límites numéricos en el generador

Los controles **Decimales máximos** (0, 1, 2, 3) y **Magnitud máxima (parte entera)** (unidades 0–9, decenas 0–99, centenas 0–999, miles 0–9999) están situados inmediatamente antes del botón **Iniciar n iteraciones**. Se aplican a los literales de las funciones generadas, incluidos coeficientes, exponentes, escalas y constantes; el signo no consume cifras. Los coeficientes ajustados se redondean y limitan antes de evaluar el error.

Cada nueva generación reinicia la mejor función actual y conserva el historial de investigaciones. El historial registra ambos límites y permite exportar CSV.

Pruebas: `node tests/generator-magnitude.test.mjs` y `python tests/smoke-generator-v47.py` (con Playwright/Chromium instalados).


### Generador 4.8 · tendencias y composición

Casillas combinables: **Logarítmicas** (`ln(x)`, `ln(1+x)`, `x ln(x)`), **Exponenciales** (`e^(kx)`, `x e^(kx)`, `x^x`), **Polinómicas** (`x`, `x^n`, con exponentes enteros positivos), y **Trigonométricas** (`sin(kx)`, `cos(kx)`, `x sin(kx)`). Si todas están desmarcadas, no se inicia la generación. Las funciones evolutivas heredan exclusivamente las familias permitidas.

Tres composiciones: `suma` (f₁ + f₂ + f₃), `producto` (f₁ · f₂ · f₃), `mixta` (f₁ · f₂ + f₃). El número de términos va de 1 a 3 para suma/producto, mientras que la mixta requiere exactamente 3; la interfaz lo fija automáticamente. La constante opcional `+c` se añade al final de cualquiera de las tres. El ajuste por mínimos cuadrados utiliza un coeficiente efectivo para cada producto y uno adicional para el tercer término de la mezcla: ajustar coeficientes individuales de factores multiplicativos sería no identificable (muchas descomposiciones equivalentes). Cada generación guarda las tendencias habilitadas y la composición en el historial CSV, junto con los errores por tramos y límites numéricos.

## Mate-fx 4.9 · Generación estable e investigación por tramos

- **Tasas exponentiales y trigonométricas:** ahora se escriben como `e^{p·x/s}` o `sin(p·x/s)` usando un divisor entero visible `s` permitido por la magnitud seleccionada. De esa forma se conserva un parámetro no nulo incluso con 0–1 decimales; el término sigue contando una sola aparición de `x`.
- **Función útil, no repetida:** se rechazan candidatas cuya predicción no varía en las observaciones y se deduplican fórmulas idénticas dentro de cada generación. El historial previo se conserva hasta que el usuario lo borre.
- **Ajuste relativo:** el cálculo de coeficientes usa mínimos cuadrados ponderados hacia el error relativo para acercar el ajuste al criterio posterior de evaluación MAPE. Se calculan los errores sobre los coeficientes realmente redondeados.
- **Limpiar historial:** botón rojo dentro del generador, requiere confirmación y elimina únicamente las funciones guardadas del proyecto activo (IndexedDB y respaldo local). Detiene primero la generación y espera que termine de guardarse el último lote. No elimina el CSV, las investigaciones ni las funciones ya copiadas a Desmos.
- **Dashboard en pestañas:** «Comparar series» (líneas/puntos), «Errores por tramos» (barras agrupadas con %E medio o E medio) y «Real vs. calculado» (barras con medias de las observaciones y las predicciones por tramo). Usa los intervalos del generador o de 1 a 20 secciones iguales.
- **Controles flotantes:** los botones verde, amarillo, rojo y azul se ocultan al abrir la tabla de investigación o un dashboard, para no tapar datos.
- **Pruebas:** `node tests/agua-stress.test.mjs`, `node tests/dashboard-bars.test.mjs`, `node tests/generator-fixes.test.mjs` y `python tests/ui-v49-browser.py` además de las pruebas anteriores.

El promedio de error por tramos omite predicciones no definidas y valores con error porcentual no definido (valor real cero); el conteo de filas se indica por tramo. Los límites de tramos contiguos no cuentan el punto fronterizo dos veces.

### v5.0 · Selección por calidad de ajuste

El generador distingue **Mejor candidata (sin ajuste aceptable)** de **Ajuste aceptable**. El umbral MAPE (1–100 %, por defecto 20 %) es configurable en «Límites de los números generados». La aceptación además requiere MAE normalizado (por el rango observado) no mayor que `max(15, umbral MAPE)` y penalización de tendencia ≤12, con cobertura ≥95 %. Estos valores son heurísticos, no garantizan una ley física ni una predicción fuera del dominio medido. En datos de rango prácticamente nulo la métrica normalizada puede ser inestable.

La clasificación mantiene MAPE como criterio principal, acompañado de 0,25 × NMAE y una penalización explícita si la pendiente de los últimos puntos observados difiere marcadamente de la predicha. La búsqueda infiere la dirección y una tasa inicial de crecimiento a partir de los datos para proponer exponenciales positivas/negativas según corresponda, conserva la exploración aleatoria y permite pequeñas correcciones discretas de coeficientes después del ajuste inicial. Todos los números de la fórmula publicada siguen respetando el límite de decimales y de magnitud. El historial guarda `MAPE`, `NMAE`, penalización, umbral y calidad, además del resto de sus metadatos originales; las entradas anteriores aparecen como «Histórico» si carecen de esas métricas.

Pruebas: `node tests/generator-quality-v50.test.mjs`, `node tests/agua-quality-v50.test.mjs` y los demás `tests/*.test.mjs`.

### v5.1 · Acotación exponencial (módulo independiente)

Nuevo botón **◈ Acotación exponencial** en el graficador de nPrimos. Busca dos exponenciales positivas que encierren **todas las observaciones del tramo correspondiente**. Ofrece exponentes compartidos o independientes; centro aritmético, geométrico, armónico o comparación automática; modo global o por tramos configurados en el Generador; vista previa, métricas MAPE y ancho relativo de la envolvente; historial por proyecto, exportación CSV y envío de las tres curvas a Desmos.

**n = número máximo TOTAL de intentos de búsqueda** (1 a 100 000) y no se multiplica por número de tramos. Por ejemplo, n=1000 y tres tramos significa 1000 intentos distribuidos entre los tres. La ejecución en Web Worker permite pausar, reanudar y detener la búsqueda. Los resultados del historial son mejoras obtenidas durante la búsqueda, no una fila por cada intento inválido o repetido. Al iniciar otra búsqueda, la mejor envolvente de esa ejecución empieza vacía y el historial anterior sigue disponible.

El módulo solo acepta valores Y positivos; los intervalos acotan los puntos medidos, **no todos los valores intermedios ni futuros**. Las restricciones de decimales y magnitud se aplican a coeficientes y parámetros; si no es posible construir una pareja de cotas bajo esas restricciones, el sistema lo informa y no inventa resultados. La clasificación de candidatas combina MAPE del centro y un término adicional de anchura relativa, que también se informa por separado. Para tramos, las curvas publicadas en Desmos incluyen una restricción de dominio.

Pruebas: `node tests/envelope-core.test.mjs`, `node tests/envelope-agua.test.mjs`, `python tests/envelope-browser.py`.