# Taller ECEDU: Explorando las Matemáticas con Herramientas Digitales

Contenido 2: medidas de tendencia central y de dispersión, cálculo e interpretación. Solo el docente mueve las actividades; los participantes entran con su nombre.

## Direcciones
- Participantes: `https://ecedu-taller.TU-USUARIO.workers.dev/`
- Docente: la misma dirección con `/docente` (pide la clave)

## Publicar en Cloudflare (gratis)
1. En tu repositorio de GitHub (`Kevin-Maturana/Talle-ECEDU`) reemplaza todo el contenido por el de esta carpeta, de modo que `wrangler.toml` quede en la raíz.
2. En dash.cloudflare.com, Workers & Pages abre el proyecto `ecedu-taller`. Al subir los cambios a GitHub se vuelve a publicar solo. (Si es nuevo: Create application, Import a repository, comando de deploy `npx wrangler deploy`.)
3. En el Worker: Settings, Variables and Secrets, agrega un **Secret** `DOCENTE_CLAVE` con tu clave. Sin esa clave el panel del docente no abre.
4. Entra a `/docente`, escribe la clave y deja esa pestaña abierta para compartirla en Teams.

Por línea de comandos: `npm install`, `npx wrangler login`, `npx wrangler deploy` y `npx wrangler secret put DOCENTE_CLAVE`.

## Antes del taller
1. Haz una prueba con tu celular y luego pulsa «Reiniciar la sesión» en el panel privado.
2. No publiques cambios durante el taller: reiniciar el servidor borra a los participantes conectados.
3. Comparte por el chat de Teams la dirección de participantes.

## Capacidad
Cada participante consulta el estado cada 4 segundos: con 100 personas son cerca de 75 000 solicitudes en 50 minutos, por debajo del límite gratuito de 100 000 por día. Evita varios ensayos grandes el mismo día. Para medir: `node load-test.mjs URL CLAVE 100`.

## Si cambias el contenido
Se edita en el proyecto de desarrollo (`build-content.mjs`) y se regenera con `node build-cloud.mjs`.
