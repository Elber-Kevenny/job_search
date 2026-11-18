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
  {
    url: "https://www.devvagas.com.br/vagas/",
    name: "devvagas",
  },
  {
    url: "https://remotar.com.br/search/jobs?q=",
    name: "remotar",
  },
  {
    url: "https://www2.infojobs.com.br/vagas.aspx?palabra=",
    name: "infojobs",
  },
];

const termosProibidos = [
  // Modalidade e Senioridade
  "presencial",
  "Presencial",
  "híbrido",
  "hibrido",
  "estágio",
  "estagio",
  "sênior",
  "senior",
  "lead",
  "pj",
  "sr",
  "vaga afirmativa",
  "pcd",

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
  "delphi",
  "elixir",
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

  const pegarVagas = URLS.find((site) => site.name === name.toLowerCase());
  if (!pegarVagas) {
    return response
      .status(400)
      .send({ message: "site informado não é suportado" });
  }

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

    let result = [];

    if (pegarVagas.name === "indeed") {
      const maxPages = 3; // manter o maximo de 3 páginas ou 50 vagas
      for (let i = 0; i < maxPages; i++) {
        const startValue = i * 10;

        const query =
          encodeURIComponent(keyWord) + `&l=Brasil&start=${startValue}`;
        const URL = pegarVagas.url + query;

        console.log(`📄 Acessando Indeed (Página ${i + 1}): ${URL}`);
        await page.goto(URL, { waitUntil: "networkidle2", timeout: 45000 });
        await page.keyboard.press("Escape");

        await page.evaluate(() => {
          const overlays = document.querySelectorAll(
            '[role="dialog"], div[class*="modal"], div[class*="overlay"]',
          );
          overlays.forEach((el) => el.remove());
        });

        try {
          await page.waitForSelector("td.resultContent, div.job_seen_beacon", {
            timeout: 7000,
          });
        } catch (err) {
          console.log(
            "ℹ️ Cards do Indeed demoraram a aparecer ou a página exigiu verificação.",
          );
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));

        const pageResult = await page.evaluate(() => {
          let linkElement = Array.from(
            document.querySelectorAll(
              "h3.jobTitle a, a.jcs-JobTitle, td.resultContent h2 a",
            ),
          );

          return linkElement.map((link) => {
            const anchor = link.tagName === "A" ? link : link.closest("a");
            return {
              title: link.textContent.trim(),
              url: anchor ? anchor.href : null,
            };
          });
        });

        console.log(
          `✨ Encontradas ${pageResult.length} vagas brutas na página ${i + 1}`,
        );
        result.push(...pageResult);

        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } else if (pegarVagas.name === "empregos.com") {
      const maxPages = 36;
      for (let i = 0; i < maxPages; i++) {
        const startValue = i;
        let query = encodeURIComponent(keyWord);
        if (startValue === 0) {
          query = encodeURIComponent(keyWord);
        }
        query = encodeURIComponent(keyWord) + `&page=${startValue}`;
        const URL = pegarVagas.url + query;

        console.log(`📄 Acessando Empregos.com (Página ${i}): ${URL}`);
        await page.goto(URL, { waitUntil: "networkidle2", timeout: 45000 });
        await page.keyboard.press("Escape");
        await page.evaluate(() => {
          const overlays = document.querySelectorAll(
            '[role="dialog"], div[class*="modal"], div[class*="overlay"]',
          );
          overlays.forEach((el) => el.remove());
        });
        await new Promise((resolve) => setTimeout(resolve, 3000));

        const pageResult = await page.evaluate((siteName) => {
          let linkElement = Array.from(
            document.querySelectorAll("div a[role='button']"),
          );
          return linkElement.map((link) => {
            const card = link.closest("#job-card");
            const titleEl = document.querySelector("h2 > span");
            const modalidade = card
              ? card.querySelector(
                  "div.flex:has(img[alt='Ícone de pessoa']):has(span)",
                )
              : null;
            const anchor = link.tagName === "A" ? link : link.closest("a");

            return {
              title: titleEl
                ? titleEl.textContent.trim()
                : link.textContent.trim(),
              url: anchor ? anchor.href : null,
              modalidadeEmpregosCom: modalidade
                ? modalidade.textContent.trim()
                : "",
            };
          });
        }, pegarVagas.name);

        result.push(...pageResult);
      }
    } else if (pegarVagas.name === "jooble") {
      const maxPages = 5;
      const query = encodeURIComponent(keyWord) + `&p=${maxPages}`;
      const URL = pegarVagas.url + query;

      console.log(`📄 Acessando Jooble: ${URL}`);
      await page.goto(URL, { waitUntil: "networkidle2", timeout: 45000 });
      await page.keyboard.press("Escape");

      await page.evaluate(() => {
        const overlays = document.querySelectorAll(
          '[role="dialog"], div[class*="modal"], div[class*="overlay"]',
        );
        overlays.forEach((el) => el.remove());
      });

      await new Promise((resolve) => setTimeout(resolve, 4000));

      let tentativasCaptcha = 0;
      const maxTentativas = 3;

      while (tentativasCaptcha < maxTentativas) {
        const turnstileFrame = page
          .frames()
          .find(
            (frame) =>
              frame.url().includes("challenges.cloudflare.com") ||
              frame.url().includes("turnstile"),
          );

        if (!turnstileFrame) {
          console.log("✨ Nenhum desafio de Cloudflare ativo no momento.");
          break;
        }

        tentativasCaptcha++;
        console.log(
          `⚠️ Desafio de CAPTCHA detectado (Tentativa ${tentativasCaptcha}/${maxTentativas})...`,
        );

        try {
          const selector =
            'input[aria-label*="Verify"], input[type="checkbox"], label, span[aria-hidden="true"], body';
          const checkboxElement = await turnstileFrame.waitForSelector(
            selector,
            {
              timeout: 6000,
              visible: true,
            },
          );

          if (checkboxElement) {
            const box = await checkboxElement.boundingBox();
            if (box) {
              await page.mouse.move(100, 100);
              await new Promise((resolve) => setTimeout(resolve, 300));

              await page.mouse.move(
                box.x + box.width / 2,
                box.y + box.height / 2,
                { steps: 10 },
              );

              await new Promise((resolve) => setTimeout(resolve, 400));
              await page.mouse.down();
              await new Promise((resolve) => setTimeout(resolve, 200));
              await page.mouse.up();

              console.log(
                "✅ Clique físico disparado. Aguardando validação do Cloudflare...",
              );
            } else {
              await checkboxElement.click();
            }

            await new Promise((resolve) => setTimeout(resolve, 15000));
          }
        } catch (err) {
          console.log("ℹ️ Elemento do CAPTCHA sumiu ou já foi resolvido.");
          break;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const pageResult = await page.evaluate((siteName) => {
        let linkElement = Array.from(document.querySelectorAll("h2 a"));
        return linkElement.map((link) => {
          const anchor = link.tagName === "A" ? link : link.closest("a");
          return {
            title: link.textContent.trim(),
            url: anchor ? anchor.href : null,
          };
        });
      }, pegarVagas.name);

      result.push(...pageResult);
    } else if (pegarVagas.name === "devvagas") {
      let URL = pegarVagas.url + encodeURIComponent(keyWord);
      console.log(`📄 Acessando Devvagas: ${URL}`);

      await page.goto(URL, { waitUntil: "networkidle2", timeout: 45000 });
      await page.keyboard.press("Escape");

      const maxScrolls = 8;
      for (let i = 0; i < maxScrolls; i++) {
        console.log(
          `⬇️ Rolando para carregar mais dados (${i + 1}/${maxScrolls})...`,
        );
        await page.evaluate(() =>
          window.scrollTo(0, document.body.scrollHeight),
        );
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }

      result = await page.evaluate(() => {
        const vagasMap = new Map();

        const scripts = Array.from(document.querySelectorAll("script"));
        for (const script of scripts) {
          const content = script.textContent || "";
          if (
            content.includes("self.__next_f") ||
            content.includes("https://www.devvagas.com.br/jobs/")
          ) {
            const regex =
              /"url"\s*:\s*"(https:\/\/www\.devvagas\.com\.br\/jobs\/[^"]+)"[^}]*?"name"\s*:\s*"([^"]+)"/g;
            let match;
            while ((match = regex.exec(content)) !== null) {
              const jobUrl = match.exec ? match[1] : match[1];
              const jobTitle = match[2]
                .replace(/\\u0026/g, "&")
                .replace(/\\u002F/g, "/")
                .trim();

              if (jobUrl && jobTitle) {
                vagasMap.set(jobUrl, { title: jobTitle, url: jobUrl });
              }
            }
          }
        }

        const anchors = Array.from(
          document.querySelectorAll('a[href*="/jobs/"]'),
        );
        for (const a of anchors) {
          if (a.href && a.textContent.trim().length > 3) {
            vagasMap.set(a.href, { title: a.textContent.trim(), url: a.href });
          }
        }

        return Array.from(vagasMap.values());
      });
    } else if (pegarVagas.name === "infojobs") {
      let URL = pegarVagas.url + encodeURIComponent(keyWord);
      console.log(`📄 Acessando Infojobs: ${URL}`);

      await page.goto(URL, { waitUntil: "networkidle2", timeout: 45000 });
      await page.keyboard.press("Escape");

      await page.evaluate(() => {
        const overlays = document.querySelectorAll(
          '[role="dialog"], div[class*="modal"], div[class*="overlay"]',
        );
        overlays.forEach((el) => el.remove());
      });

      const maxScrolls = 5;
      for (let i = 0; i < maxScrolls; i++) {
        console.log(
          `⬇️ Rolando Infojobs para carregar mais vagas (${i + 1}/${maxScrolls})...`,
        );

        await page.evaluate(() =>
          window.scrollTo(0, document.body.scrollHeight),
        );
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }

      const pageResult = await page.evaluate(() => {
        let titleElements = Array.from(
          document.querySelectorAll("h2.js_vacancyTitle"),
        );

        return titleElements
          .map((titleEl) => {
            const anchor = titleEl.closest("a");
            const rawTitle = titleEl.textContent || "";
            const cleanTitle = rawTitle.replace(/\s+/g, " ").trim();

            return {
              title: cleanTitle,
              url: anchor ? anchor.href : null,
            };
          })
          .filter((vaga) => vaga.title.length > 2 && vaga.url);
      });

      console.log(
        `✨ Total de vagas válidas capturadas no Infojobs: ${pageResult.length}`,
      );
      result.push(...pageResult);
    } else {
      let query;
      if (name.toLowerCase() === "glassdoor") {
        query =
          keyWord.trim().replace(/\s+/g, "-") +
          "-SRCH_IL.0,15_IS12226_KO16,43.htm?jl=1010287906099&srs=JV_APPLYPANE";
      } else if (name.toLowerCase() === "solides") {
        query = keyWord.trim().replace(/\s+/g, "-");
      } else {
        query = encodeURIComponent(keyWord);
      }

      let URL = pegarVagas.url + query;

      await page.goto(URL, { waitUntil: "networkidle2", timeout: 45000 });
      await page.keyboard.press("Escape");
      await page.evaluate(() => {
        const overlays = document.querySelectorAll(
          '[role="dialog"], div[class*="modal"], div[class*="overlay"]',
        );
        overlays.forEach((el) => el.remove());
      });
      await new Promise((resolve) => setTimeout(resolve, 1000));

      result = await page.evaluate((siteName) => {
        let linkElement;

        switch (siteName) {
          case "solides":
            linkElement = Array.from(document.querySelectorAll("h2 a"));
            break;
          case "gupy":
            linkElement = Array.from(document.querySelectorAll("h3 a"));
            break;

          case "remotar":
            linkElement = Array.from(document.querySelectorAll("a.job-title"));
            break;

          default:
            linkElement = [];
            break;
        }

        return linkElement.map((link) => {
          const anchor = link.tagName === "A" ? link : link.closest("a");
          if (siteName.name === "remotar") {
            const card =
              link.closest("div.card-header__info") || link.parentElement;
            return {
              title: link.textContent.trim(),
              url: link.href,
            };
          }
          return {
            title: link.textContent.trim(),
            url: anchor ? anchor.href : null,
          };
        });
      }, pegarVagas.name);
    }

    if (pegarVagas.name === "glassdoor") {
      console.log(`📄 Acessando Glassdoor`);

      await page.keyboard.press("Escape");

      await page.evaluate(() => {
        const overlays = document.querySelectorAll(
          '[role="dialog"], div[class*="modal"], div[class*="overlay"]',
        );
        overlays.forEach((el) => el.remove());
      });

      const maxCliques = 5;
      let cliquesRealizados = 0;

      while (cliquesRealizados < maxCliques) {
        try {
          const loadMoreButton = await page.$(
            'button[data-test="load-more"], button[id*="loadMore"], [class*="load-more"]',
          );

          if (!loadMoreButton) {
            console.log(
              "ℹ️ Botão 'Carregar mais' não exibido (ou todas as vagas já estão visíveis). Prosseguindo...",
            );
            break;
          }

          await loadMoreButton.evaluate((btn) =>
            btn.scrollIntoView({ behavior: "smooth", block: "center" }),
          );
          await new Promise((resolve) => setTimeout(resolve, 1000));

          await loadMoreButton.click();
          cliquesRealizados++;
          console.log(
            `🔄 Clicou em 'Carregar mais' (${cliquesRealizados}/${maxCliques})...`,
          );

          await new Promise((resolve) => setTimeout(resolve, 3000));
        } catch (err) {
          console.log("ℹ️ Fim do ciclo de carregamento de mais vagas.");
          break;
        }
      }

      const pageResult = await page.evaluate(() => {
        let linkElement = Array.from(
          document.querySelectorAll("a[data-test='job-title']"),
        );
        return linkElement.map((link) => {
          const anchor = link.tagName === "A" ? link : link.closest("a");
          return {
            title: link.textContent.trim(),
            url: anchor ? anchor.href : null,
          };
        });
      });

      result.push(...pageResult);
    }

    console.log(`--- VAGAS CAPTURADAS NO TOTAL (RAW): ${result.length} ---`);
    console.log(
      `--- VAGAS CAPTURADAS : ${JSON.stringify(result, null, 2)} ---`,
    );
    const escapeRegex = (string) =>
      string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    for (const vaga of result) {
      if (!vaga.title || !vaga.url) continue;
      const normalizedTitle = vaga.title.toLowerCase();
      const normalizedModalidadeEmpregos = (
        vaga.modalidadeEmpregosCom || ""
      ).toLowerCase();

      let termoEncontrado = null;
      const tituloTemTermoProibido = termosProibidos.some((termo) => {
        const termoEscapado = escapeRegex(termo);
        const possuiEspeciais = /[^a-zA-Z0-9\s]/.test(termo);
        const pattern = possuiEspeciais
          ? termoEscapado
          : `\\b${termoEscapado}\\b`;
        const regex = new RegExp(pattern, "i");
        const regexModalidade = new RegExp(termoEscapado, "i");
        if (regex.test(normalizedTitle)) {
          termoEncontrado = termo;
          return true;
        }
        if (regexModalidade.test(normalizedModalidadeEmpregos)) {
          termoEncontrado = termo;
          return true;
        }
        return false;
      });

      if (tituloTemTermoProibido) {
        console.log(
          `🚫 Rejeitada pelo Título (termo proibido "${termoEncontrado}"): "${vaga.title}`,
        );
        continue;
      }

      console.log(`✅ Aprovada no título: "${vaga.title}"`);
      vagasEncontradas.push(vaga);
    }

    console.log(
      `--- VAGAS APÓS FILTRAGEM DE TÍTULO: ${vagasEncontradas.length} ---`,
    );
    console.log("Vagas aprovadas pelo título:", vagasEncontradas);

    if (vagasEncontradas.length === 0) {
      console.log("❌ Nenhuma vaga passou pelos filtros de título.");
      await browser.close();
      return response.status(404).send({ message: "not found" });
    } else {
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
            let tentativasCaptcha = 0;
            const maxTentativas = 3;
            const turnstileFrame = pageFiltered
              .frames()
              .find(
                (frame) =>
                  frame.url().includes("challenges.cloudflare.com") ||
                  frame.url().includes("turnstile"),
              );

            if (!turnstileFrame) {
              console.log(
                "✨ Nenhum desafio de Cloudflare ativo no Glassdoor.",
              );
              break;
            }

            if (turnstileFrame) {
              tentativasCaptcha++;
              console.log(
                "⚠️ Desafio de CAPTCHA/Cloudflare detectado! Tentando resolver...",
              );
              try {
                const selector =
                  'input[aria-label*="Verify"], input[type="checkbox"], label, span[aria-hidden="true"]';
                const checkboxElement = await turnstileFrame.waitForSelector(
                  selector,
                  {
                    timeout: 6000,
                    visible: true,
                  },
                );

                if (checkboxElement) {
                  const box = await checkboxElement.boundingBox();
                  if (box) {
                    await pageFiltered.mouse.move(
                      box.x + box.width / 2,
                      box.y + box.height / 2,
                      { steps: 8 },
                    );
                    await new Promise((resolve) => setTimeout(resolve, 400));
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
                }
              } catch (err) {
                console.log(
                  "ℹ️ Checkbox não clicável ou o desafio resolveu sozinho.",
                );
                break;
              }
            }
          }

          await pageFiltered.keyboard.press("Escape");
          await pageFiltered.evaluate(() => {
            const overlays = document.querySelectorAll(
              '[role="dialog"], div[class*="modal"], div[class*="overlay"]',
            );
            overlays.forEach((el) => el.remove());
          });

          const pageData = await pageFiltered.evaluate((siteName) => {
            let container;
            let modalidadeText = "";

            if (siteName === "infojobs") {
              const modalidadeEl = document.querySelector(
                "div.text-medium:has(svg.icon-buildings), div:has(> svg.icon-buildings)",
              );
              if (modalidadeEl) {
                const clone = modalidadeEl.cloneNode(true);
                const svg = clone.querySelector("svg");
                if (svg) svg.remove();
                modalidadeText = clone.textContent.trim();
              }
            }

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
                const h3List = Array.from(
                  document.querySelectorAll("div.bg-white > h3"),
                );
                const descH3 = h3List.find((h) =>
                  h.textContent.includes("Descrição da vaga"),
                );
                if (descH3) {
                  container =
                    descH3.nextElementSibling ||
                    descH3.parentElement.querySelector(
                      "div[class*='break-words']",
                    );
                } else {
                  container =
                    document.querySelector('div[class*="break-words"]') ||
                    document.querySelector("main");
                }
                break;

              case "solides":
                container = document.querySelector("span p");
                break;

              case "gupy":
                container = document.querySelector("div li span");
                break;

              case "devvagas":
                container = document.querySelector("div.prose:has(h2)");
                break;

              case "remotar":
                container = document.querySelector("div.job-information");
                break;

              case "jooble":
                container = document.querySelector(
                  "div[data-test-name='_jobDescriptionBlock']",
                );
                break;

              case "infojobs":
                container =
                  document.querySelector("div.js_vacancyDataPanels") ||
                  document.querySelector('div[class*="vacancy-description"]') ||
                  document.querySelector("main");
                break;

              default:
                break;
            }

            return {
              descriptionText: container ? container.innerText.trim() : "",
              modalidadeText: modalidadeText || "",
            };
          }, pegarVagas.name);

          const fullTextToFilter = `Modalidade: ${pageData.modalidadeText} Descrição ${pageData.descriptionText}`;

          const descTemTermoProibido = termosProibidos.some((termo) => {
            const termoEscapado = escapeRegex(termo);
            const possuiEspeciais = /[^a-zA-Z0-9\s]/.test(termo);
            const pattern = possuiEspeciais
              ? termoEscapado
              : `\\b${termoEscapado}\\b`;
            const regex = new RegExp(pattern, "i");
            return regex.test(fullTextToFilter);
          });

          if (!descTemTermoProibido) {
            vagasComDescricao.push({
              title: vaga.title,
              url: vaga.url,
              description: pageData.descriptionText,
              modalidade: pageData.modalidadeText || "Não informada",
            });
          } else {
            console.log(`🚫 Vaga rejeitada pela descrição: "${vaga.title}"`);
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

      console.log(
        `--- VAGAS FINAIS APÓS FILTRAGEM DE DESCRIÇÃO: ${vagasComDescricao.length} ---`,
      );

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
