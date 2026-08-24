# Mate-fx

**Mate-fx** es un laboratorio geométrico interactivo para explorar funciones evaluadas **únicamente en los naturales**. La idea central no es dibujar la gráfica cartesiana usual, sino separar la **entrada** `x` y la **salida** `f(x)` en dos ejes cuyo ángulo puede variar de `0°` a `360°`.

La aplicación está pensada como una herramienta experimental: mover el ángulo permite observar qué propiedades geométricas cambian y cuáles sobreviven.

## Dos modos, una sola idea

### Rectas

Para cada `x ∈ ℕ`:

- se marcan `(+x, 0)` y `(-x, 0)` sobre el eje de entrada;
- se coloca `f(x)` sobre el eje de salida rotado un ángulo `θ`;
- se conectan ambos extremos con el punto de salida mediante segmentos.

Si

```text
Q = f(x) (cos θ, sin θ)
```

entonces el área orientada del triángulo es

```text
A(θ) = x f(x) sin θ
```

El producto `x f(x)` actúa como amplitud angular.

Las distancias desde `+x` y `-x` al punto de salida satisfacen

```text
d₊² = x² + f(x)² - 2 x f(x) cos θ
d₋² = x² + f(x)² + 2 x f(x) cos θ
```

y por tanto

```text
d₋² - d₊² = 4 x f(x) cos θ.
```

Así, el mismo producto aparece en dos observables ortogonales: seno (área) y coseno (asimetría de longitudes).

### Curvas

Cuando los ejes son perpendiculares, cada conexión se construye como un **cuarto de elipse** en las coordenadas locales de los ejes:

```text
(u/x)² + (v/f(x))² = 1.
```

El arco positivo conecta `(+x, 0)` con el punto `f(x)`; el arco negativo conecta `(-x, 0)` con el mismo punto. Si `f(x)` cambia de signo, los cuartos de elipse aparecen en los cuadrantes correspondientes.

En una posición perpendicular, el área orientada de un cuarto de elipse es

```text
Aₑ = (π/4) x f(x).
```

Al rotar el eje de salida mediante la transformación lineal natural de la base local, el factor angular es `sin θ`:

```text
Aₑ(θ) = (π/4) x f(x) sin θ.
```

#### Convención al coincidir los ejes

La elipse afín se degenera cuando los ejes coinciden. Para conservar la intuición original del proyecto, Mate-fx aplica una **regularización visual suave** cerca de `0°`, `180°` y `360°`:

- la conexión asociada a `+x` pasa por arriba;
- la conexión asociada a `-x` pasa por abajo;
- en la coincidencia exacta se visualizan arcos semicirculares.

La regularización modifica solo la forma visual del conector en la zona degenerada. Los puntos extremos, `Q` y los invariantes analíticos se siguen calculando con las fórmulas exactas.

## Funciones

El campo de entrada acepta expresiones como:

- `x^2`
- `x^n`
- `ln(x)`
- `sin(x)` o `sen(x)`
- `tan(x)`
- `exp(x)`
- `n^x`
- `abs(x)` o `|x|`
- `x`
- `-x`

También se admiten `cos`, `sqrt`, `log`, `floor`, `ceil`, `round`, `min`, `max`, constantes `pi`, `e` y los operadores `+ - * / ^ %`.

`x` es siempre el natural evaluado. `n` es un parámetro libre para familias como `x^n` o `n^x`.

Las funciones trigonométricas se evalúan en **radianes**.

## Interacción

- Slider o entrada numérica para `θ ∈ [0°, 360°]`.
- Animación automática del ángulo.
- Zoom con rueda del mouse.
- Desplazamiento arrastrando el lienzo.
- Clic sobre cualquier objeto para inspeccionar `x`, `f(x)`, `Q`, `x·f(x)` y otras relaciones.
- Rango configurable de naturales hasta `x = 50`.
- Ajuste automático de la vista.

## Ejecutar

No requiere compilación ni dependencias.

Abre `index.html` en un navegador moderno o sirve la carpeta con cualquier servidor estático, por ejemplo:

```bash
python -m http.server 8000
```

Luego abre `http://localhost:8000`.

El proyecto está preparado para alojarse como sitio estático en GitHub Pages.
