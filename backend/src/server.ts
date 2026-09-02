import { createApp } from "./api/app.js";

const PORT = process.env.PORT ? Number(process.env.PORT) : 3333;

createApp().then((app) => {
  app.listen(PORT, () => {
    console.log(`API de Cadastros rodando em http://localhost:${PORT}`);
    console.log(`Catálogo de recursos: http://localhost:${PORT}/api/cadastros/_catalogo`);
  });
});
