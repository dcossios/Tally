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

Crea una automatización personal en Shortcuts usando filtro por contenido:

1. Usa el trigger **Mensaje** y deja vacío **Remitente**.
2. En **Mensaje contiene**, usa una palabra clave estable como
   `Bancolombia`, `transferiste`, `compraste` o `recibiste`.
3. Añade **Obtener contenido de URL**.
4. Usa el endpoint mostrado en **Ajustes**, método `POST`.
5. Añade el header `Authorization` con el valor `Bearer TU_TOKEN`.
6. Selecciona cuerpo `JSON`:

```json
{
  "sender": "REMITENTE_DEL_TRIGGER_O_890220",
  "message": "CONTENIDO_DEL_MENSAJE_RECIBIDO",
  "receivedAt": "FECHA_ACTUAL_EN_ISO_8601"
}
```

En Shortcuts, `message` debe usar la variable proporcionada por el trigger.
Para `sender`, usa la variable del remitente o fija `890220` si tu
automatización ya quedó acotada a mensajes del banco por contenido. Para
`receivedAt`, usa **Fecha actual** y **Formatear fecha** con formato ISO 8601.
Activa **Ejecutar inmediatamente** o desactiva **Preguntar antes de ejecutar**,
según la versión de iOS.

Respuestas del endpoint:

- `201 created`: movimiento registrado. Devuelve `code`, `importId`,
  `transactionId`, `parserRule`, `receivedAt` y `normalizedHash`.
- `202 pending`: guardado para revisión. Devuelve `parserError` cuando el
  parser no pudo confirmar el formato.
- `200 duplicate`: el SMS ya había sido importado. Devuelve el `importId`
  existente y su `importStatus`.
- `400`: `json_invalid`, `payload_invalid` o `received_at_invalid`.
- `401`: `token_required` o `token_invalid`.
- `403`: `sender_not_allowed`, junto con `sender` y `normalizedSender`.

## Comandos

```bash
npm run build
npm run lint
npm test
```

Los tests cubren transferencias, compras COP, compras USD, nómina, variantes
de espacios y separadores monetarios.
