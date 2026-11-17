import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteer.use(StealthPlugin());

const URLS = [
  {
    url: "https://br.indeed.com/jobs?q=",
    name: "indeed",
  },

  {
    url: "https://br.jooble.org/SearchResult?ukw=",
    name: "jooble",
  },
  {
    url: "https://www.glassdoor.com.br/Vaga/",
    name: "glassdoor",
  },
  {
    url: "https://www.empregos.com.br/buscar-vagas?termo=",
    name: "empregos.com",
  },
  {
    url: "https://vagas.solides.com.br/vagas/",
    name: "solides",
  },
  {
    url: "http://portal.gupy.io/job-search/term=",
    name: "gupy",
  },
];

const termosProibidos = [
  // Modalidade e Senioridade
  "presencial",
  "híbrido",
  "hibrido",
  "estágio",
  "estagio",
  "sênior",
  "senior",
  "lead",
  "pj",
  "vaga afirmativa",

  // Tecnologias adicionadas previamente
  "c++",
  "ruby",

  // Novas linguagens e frameworks solicitados
  "java",
  "spring",
  "springboot",
  "spring boot",
  "php",
  "golang",
  "go",
  "net",
  ".net",
  "c#",
  "python",
  "phyton",
];

export const getHtml = async (request, response) => {
  const vagasEncontradas = [];
  const vagasComDescricao = [];
  const { keyWord, name } = request.body;
  let browser;
  if (!keyWord) {
    return response.status(400).send({ message: "keyword vazia" });
  }
  if (!name) {
    return response.status(400).send({ message: "name vazio" });
  }
  let query;

  if (name === "glassdoor") {
    query =
      keyWord.trim().replace(/\s+/g, "-") +
      "-SRCH_KO0,36.htm?pos=101&ao=1136043&s=58&guid=000001a0f934d3c8b9baa3bed67ab14a&src=GD_JOB_AD&t=SR&vt=w&cs=1_33739d64&cb=1790887384219&jrtk=5-yul1-0-1k3sj9kvjk8go800-c83133d64bd665a8&jl=1010301417449";
  }
  if (name === "solides") {
    query = keyWord.trim().replace(/\s+/g, "-");
  } else {
    query = encodeURIComponent(keyWord);
  }

  const pegarVagas = URLS.find((site) => site.name === name.toLowerCase());
  if (!pegarVagas) {
    return response
      .status(400)
      .send({ message: "site informado não é suportado" });
  }
  let URL = pegarVagas.url + query;

  try {
    browser = await puppeteer.launch({
      headless: false,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });

    await page.goto(URL, { waitUntil: "networkidle2", timeout: 45000 });
    await page.keyboard.press("Escape");
    await page.evaluate(() => {
      const overlays = document.querySelectorAll(
        '[role="dialog"], div[class*="modal"], div[class*="overlay"]',
      );
      overlays.forEach((el) => el.remove());
    });
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const result = await page.evaluate((siteName) => {
      let linkElement;
      switch (siteName) {
        case "indeed":
          linkElement = Array.from(document.querySelectorAll("h3 a span"));
          break;

        case "jooble":
          linkElement = Array.from(document.querySelectorAll("h2 a"));
          break;

        case "glassdoor":
          linkElement = Array.from(
            document.querySelectorAll("a[data-test=job-title]"),
          );
          break;

        case "empregos.com":
          linkElement = Array.from(
            document.querySelectorAll("div:has(> h2 > a)"),
          );
          break;

        case "solides":
          linkElement = Array.from(document.querySelectorAll("h2 a"));
          break;

        case "gupy":
          linkElement = Array.from(document.querySelectorAll("h3 a"));
          break;
      }

      return linkElement.map((link) => {
        const anchor = link.tagName === "A" ? link : link.closest("a");
        return {
          title: link.textContent.trim(),
          url: anchor ? anchor.href : null,
        };
      });
    }, pegarVagas.name);

    console.log(`--- VAGAS CAPTURADAS NO TOTAL: ${result.length} ---`);
    console.log(result); // Mostra as 5 primeiras vagas no console

    const normalizedKey = keyWord.trim().toLowerCase().split(" ");
    // desenvolvedor fullstack vaga remota

    for (const vaga of result) {
      if (!vaga.title || !vaga.url) continue;
      const normalizedTitle = vaga.title.toLowerCase();
      const encontrou = normalizedKey.some((termo) =>
        normalizedTitle.includes(termo),
      );
      if (encontrou) {
        vagasEncontradas.push(vaga);
      }
    }

    if (vagasEncontradas.length === 0) {
      console.log("❌ Nenhuma vaga correspondeu à palavra-chave exata.");
      await browser.close();
      return response.status(404).send({ message: "not found" });
    } else {
      // response.status(200).send(vagasEncontradas);
      // if(pegarVagas.name === "glassdoor") {
      //   container = document.querySelector(
      //             "div.joDetails_jobDescription__uW_fk p",
      //           );
      // }

      for (const vaga of vagasEncontradas) {
        const pageFiltered = await browser.newPage();
        try {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          await pageFiltered.goto(vaga.url, {
            waitUntil: "domcontentloaded",
            timeout: 65000,
          });
          await new Promise((resolve) => setTimeout(resolve, 6000));
          await page.keyboard.press("Escape");
          if (pegarVagas.name === "glassdoor") {
            await new Promise((resolve) => setTimeout(resolve, 8000));

            const turnstileFrame = pageFiltered
              .frames()
              .find(
                (frame) =>
                  frame.url().includes("challenges.cloudflare.com") ||
                  frame.url().includes("turnstile"),
              );

            if (turnstileFrame) {
              console.log(
                "⚠️ Desafio de CAPTCHA/Cloudflare detectado! Tentando resolver...",
              );

              try {
                // Tenta esperar pela checkbox dentro do iframe (máximo 5s)
                const selector =
                  'input[aria-label*="Verify"], input[type="checkbox"], label, span[aria-hidden="true"]';
                const checkboxElement = await captchaFrame.waitForSelector(
                  selector,
                  {
                    timeout: 5000,
                    visible: true,
                  },
                );

                if (checkboxElement) {
                  // Tenta pegar a posição exata do elemento na tela para simular o mouse do usuário
                  const box = await checkboxElement.boundingBox();
                  if (box) {
                    await pageFiltered.mouse.move(
                      box.x + box.width / 2,
                      box.y + box.height / 2,
                    );
                    await pageFiltered.mouse.down();
                    await new Promise((resolve) => setTimeout(resolve, 150));
                    await pageFiltered.mouse.up();
                    console.log(
                      "✅ Clique físico disparado no Turnstile do Glassdoor!",
                    );
                  } else {
                    await checkboxElement.click();
                  }

                  await new Promise((resolve) => setTimeout(resolve, 6000));
                  // Aguarda a verificação processar e redirecionar
                }
              } catch (err) {
                console.log(
                  "ℹ️ Checkbox não clicável ou o desafio resolveu sozinho.",
                );
              }
            }
          }

          //  if (pegarVagas.name === "glassdoor") {
          //     // Pausa inicial para o Cloudflare injetar o desafio na página
          //     await new Promise((resolve) => setTimeout(resolve, 4000));

          //     // Verifica se existe alguma mensagem de bloqueio ou verificação humana visível
          //     const temBloqueio = await pageFiltered.evaluate(() => {
          //       const bodyText = document.body.innerText.toLowerCase();
          //       return (
          //         bodyText.includes("verify you are human") ||
          //         bodyText.includes("verificando se você é humano") ||
          //         bodyText.includes("access denied") ||
          //         document.querySelector('iframe[src*="cloudflare"]') !== null ||
          //         document.querySelector('iframe[src*="turnstile"]') !== null
          //       );
          //     });

          //     if (temBloqueio) {
          //       console.log("\n🛑 ----------------------------------------------------");
          //       console.log("🛑 BLOQUEIO/CAPTCHA DO GLASSDOOR DETECTADO!");
          //       console.log("🛑 Por favor, vá até a janela do navegador e resolva manualmente.");
          //       console.log("🛑 O script está pausado e aguardando você resolver...");
          //       console.log("🛑 ----------------------------------------------------\n");

          //       // Fica travado aqui em loop até o texto de bloqueio sumir da tela
          //       await pageFiltered.waitForFunction(
          //         () => {
          //           const text = document.body.innerText.toLowerCase();
          //           const temIframe = document.querySelector('iframe[src*="cloudflare"]') !== null ||
          //                             document.querySelector('iframe[src*="turnstile"]') !== null;

          //           // Retorna true (libera o código) somente quando o aviso E o iframe sumirem
          //           return !text.includes("verify you are human") && !temIframe;
          //         },
          //         { timeout: 120000, polling: 1000 } // Dá até 2 minutos para você resolver com calma
          //       );

          //       console.log("✅ CAPTCHA resolvido com sucesso! Retomando a extração...");
          //       await new Promise((resolve) => setTimeout(resolve, 3000)); // Tempo para estabilizar a página
          //     }
          //   }

          await pageFiltered.keyboard.press("Escape");
          await pageFiltered.evaluate(() => {
            const overlays = document.querySelectorAll(
              '[role="dialog"], div[class*="modal"], div[class*="overlay"]',
            );
            overlays.forEach((el) => el.remove());
          });
          const descriptionText = await pageFiltered.evaluate((siteName) => {
            let container;
            switch (siteName) {
              case "indeed":
                container =
                  document.querySelector(
                    'div.css-g5y9jx:has(> h4[data-testid="vj-job-description-heading"])',
                  ) ||
                  document.querySelector('[data-testid="job-description"]');
                break;

              case "glassdoor":
                container = document.querySelector(
                  "div.joDetails_jobDescription__uW_fk p",
                );

                break;

              case "empregos.com":
                container = document.querySelector("div p");
                break;

              case "solides":
                container = document.querySelector("span p");
                break;

              case "gupy":
                container = document.querySelector("div li span");
                break;
              default:
                container = document.querySelector(
                  "div[data-test-name='_jobDescriptionBlcok']",
                );
            }

            return container ? container.innerText.trim() : "";
          }, pegarVagas.name);

          const escapeRegex = (string) =>
            string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const temTermoProibido = termosProibidos.some((termo) => {
            const termoEscapado = escapeRegex(termo);
            const possuiEspeciais = /[^a-zA-Z0-9\s]/.test(termo);

            const pattern = possuiEspeciais
              ? termoEscapado
              : `\\b${termoEscapado}\\b`;

            const regex = new RegExp(pattern, "i");
            return regex.test(descriptionText);
          });

          if (!temTermoProibido) {
            vagasComDescricao.push({
              title: vaga.title,
              url: vaga.url,
              description: descriptionText,
            });
          }
        } catch (e) {
          console.error(
            `Erro ao processar descrição da vaga ${vaga.url}:`,
            e.message,
          );
        } finally {
          await pageFiltered.close();
        }
      }

      await browser.close();

      if (vagasComDescricao.length === 0) {
        return response.status(404).send({
          message: "Nenhuma vaga válida após aplicar o filtro de descrição.",
        });
      }

      return response.status(200).send(vagasComDescricao);
    }
  } catch (e) {
    console.error("Erro ao executar a API", e.message);
    if (browser) await browser.close();

    if (!response.headersSent) {
      return response
        .status(500)
        .send({ message: "erro interno no scraper", details: e.message });
    }
  }
};
// export const getCorrespondecia = async (request, response) => {
//   const vagasEncontradas = [];
//   const { keyWord, name } = request.body;
//   let browser;
//   if (!keyWord) {
//     return response.status(400).send({ message: "keyword vazia" });
//   }
//   if (!name) {
//     return response.status(400).send({ message: "name vazio" });
//   }
//   const query = encodeURIComponent(keyWord);
//   const pegarVagas = URLS.find((site) => site.name === name.toLowerCase());
//   if (!pegarVagas) {
//     return response
//       .status(400)
//       .send({ message: "site informado não é suportado" });
//   }
//   const URL = pegarVagas.url + query;

//   try {
//     browser = await puppeteer.launch({
//       headless: false,
//       args: [
//         "--no-sandbox",
//         "--disable-setuid-sandbox",
//         "--disable-blink-features=AutomationControlled",
//       ],
//     });

//     const page = await browser.newPage();
//     await page.setViewport({ width: 1366, height: 768 });

//     await page.goto(URL, { waitUntil: "networkidle2", timeout: 45000 });
//     await page.keyboard.press("Escape");
//     await page.evaluate(() => {
//       const overlays = document.querySelectorAll(
//         '[role="dialog"], div[class*="modal"], div[class*="overlay"]',
//       );
//       overlays.forEach((el) => el.remove());
//     });
//     await new Promise((resolve) => setTimeout(resolve, 1000));
//     const result = await page.evaluate((siteName) => {
//       let linkElement;
//       switch (siteName) {
//         case "indeed":
//           linkElement = Array.from(document.querySelectorAll("h3 a span"));
//           break;

//         case "jooble":
//           linkElement = Array.from(document.querySelectorAll("h2 a"));
//           break;

//         case "glassdoor":
//           linkElement = Array.from(
//             document.querySelectorAll("a[data-test=job-title]"),
//           );
//           break;

//         case "empregos.com":
//           linkElement = Array.from(document.querySelectorAll("h2 a"));
//           break;

//         case "solides":
//           linkElement = Array.from(document.querySelectorAll("h2 a"));
//           break;

//         case "gupy":
//           linkElement = Array.from(document.querySelectorAll("h3 a"));
//           break;
//       }

//       return linkElement.map((link) => {
//         const anchor = link.tagName === "A" ? link : link.closest("a");
//         return {
//           title: link.textContent.trim(),
//           url: anchor ? anchor.href : null,
//         };
//       });
//     }, pegarVagas.name);

//     console.log(`--- VAGAS CAPTURADAS NO TOTAL: ${result.length} ---`);
//     console.log(result.slice(0, 5)); // Mostra as 5 primeiras vagas no console

//     const normalizedKey = keyWord.trim().toLowerCase().split(" ");
//     // desenvolvedor fullstack vaga remota

//     for (const vaga of result) {
//       if (!vaga.title || !vaga.url) continue;
//       const normalizedTitle = vaga.title.toLowerCase();
//       const encontrou = normalizedKey.some((termo) =>
//         normalizedTitle.includes(termo),
//       );
//       if (encontrou) {
//         vagasEncontradas.push(vaga);
//       }
//     }
//     await browser.close();

//     if (vagasEncontradas.length === 0) {
//       console.log("❌ Nenhuma vaga correspondeu à palavra-chave exata.");
//       return response.status(404).send({ message: "not found" });
//     } else {
//       return response.status(200).send(vagasEncontradas);
//     }
//   } catch (e) {
//     console.error("Erro ao executar a API", e.message);
//     if (browser) {
//       await browser.close();
//     }

//     if (!response.headersSent) {
//       return response
//         .status(500)
//         .send({ message: "erro interno no scraper", details: e.message });
//     }
//   }
// };
