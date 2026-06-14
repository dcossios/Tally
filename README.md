# Saldo

PWA mobile-first para registrar ingresos y gastos manualmente o importar
notificaciones de Bancolombia desde iOS Shortcuts.

## Stack

- React 18, Vite 8, Tailwind y shadcn/ui
- Convex Database, HTTP Actions y Convex Auth con contraseña
- Vitest para el parser de SMS
- Vite PWA para instalación en iPhone

## Desarrollo

```bash
npm install
npx convex dev
node setup.mjs --once
npm run dev:frontend
```

El setup solicita la URL local y configura `SITE_URL`, `JWT_PRIVATE_KEY` y
`JWKS` en el deployment de Convex. Las variables locales se guardan en
`.env.local`.

## Automatización de iPhone

Primero inicia sesión en Saldo, abre **Ajustes** y crea un token para el
Shortcut. El token se muestra una sola vez.

Crea tres automatizaciones personales en Shortcuts, una para cada remitente:

- `855-40852-86`
- `874-00`
- `857-84`

En cada automatización:

1. Usa el trigger **Mensaje**, selecciona un remitente y deja vacío
   **Mensaje contiene**.
2. Añade **Obtener contenido de URL**.
3. Usa el endpoint mostrado en **Ajustes**, método `POST`.
4. Añade el header `Authorization` con el valor `Bearer TU_TOKEN`.
5. Selecciona cuerpo `JSON`:

```json
{
  "sender": "NUMERO_CONFIGURADO_EN_ESTA_AUTOMATIZACION",
  "message": "CONTENIDO_DEL_MENSAJE_RECIBIDO",
  "receivedAt": "FECHA_ACTUAL_EN_ISO_8601"
}
```

En Shortcuts, `message` debe usar la variable proporcionada por el trigger.
Para `receivedAt`, usa **Fecha actual** y **Formatear fecha** con formato ISO
8601. Activa **Ejecutar inmediatamente** o desactiva **Preguntar antes de
ejecutar**, según la versión de iOS.

Respuestas del endpoint:

- `201 created`: movimiento registrado.
- `202 pending`: guardado para revisión.
- `200 duplicate`: el SMS ya había sido importado.
- `401`: token inválido o revocado.
- `403`: remitente no autorizado.

## Comandos

```bash
npm run build
npm run lint
npm test
```

Los tests cubren transferencias, compras COP, compras USD, nómina, variantes
de espacios y separadores monetarios.
