import express from "express";
import { router } from "./routes/articleRouter.js";

const app = express();

const PORT = 3000;

app.use(express.json());
app.use(router);
app.listen(PORT, () => {
  console.log(`server running http://localhost:${PORT}`);
});

// console.log(await getHtml('Should'))

// const getHtml = async () => {
//   try {
//     const response = await fetch(URL, {
//       method: 'GET',
//       headers: {
//         // Simula a requisição de um navegador Chrome real no Windows
//         'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
//         'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
//         'Accept-Language': 'en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7',
//       },
//     });

//     if (!response.ok) {
//       throw new Error(`Erro na requisição ${response.status}`)
//     }
//     const text = await response.text();
//     const $ = load(text);
//     const elements = $('article');
//     elements.each((i, element) => {
//       const title = $(element).find('h2').text();
//       const url = $(element).find('a').attr('href')
//     console.log(`title: ${title} and url: ${url}`);
// })
//     return text;
//   } catch (e) {
//     console.error('Erro na chamada da API:', e.message);
//     throw e;
//   }
// };

//
