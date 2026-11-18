
# 🚀 Job Scraper API (Node.js + Puppeteer)

API desenvolvida em **Node.js** utilizando **Puppeteer** e **Puppeteer Extra (Stealth Plugin)** para realizar scraping automatizado de vagas de emprego em múltiplos portais (Indeed, Jooble, Glassdoor, Empregos.com, Solides, Gupy, Devvagas e Remotar).

O sistema conta com um pipeline inteligente de duas etapas: filtragem preliminar por termos proibidos no título e validação profunda de requisitos na descrição completa da vaga.

---

## 🛠️ Tecnologias Utilizadas

* **Node.js**
* **Puppeteer & Puppeteer-Extra-Plugin-Stealth** (para contornar bloqueios, Cloudflare/Turnstile e automação de navegador Headless)
* **Express.js** (para exposição do endpoint)

---

## 📋 Como Funciona (Fluxo de Execução)

1. **Validação Inicial**: Verifica se a palavra-chave (`keyWord`) e a plataforma (`name`) foram informadas na requisição.
2. **Navegação Inteligente**:
* **Indeed & Jooble**: Utilizam paginação baseada em parâmetros de URL (`start` e `p`).
* **Devvagas**: Executa rolagem infinita (`scroll`) para carregar o stream de dados do Next.js (`__next_f` e DOM) e extrai o payload completo de listagem.
* **Demais portais**: Navegam pelas rotas de busca customizadas de cada plataforma.


3. **Filtro de Título (Etapa 1)**: Varre a lista bruta de vagas coletadas e descarta imediatamente aquelas que contêm termos proibidos configurados (como senioridade indesejada, modalidade presencial/híbrida ou tecnologias fora do escopo).
4. **Filtro de Descrição (Etapa 2)**: Abre individualmente a página de cada vaga aprovada no título, extrai o texto completo da descrição e realiza uma nova validação rigorosa de termos proibidos.
5. **Retorno da API**: Retorna uma lista limpa contendo o título, a URL oficial e o texto da descrição de todas as vagas aprovadas.

---

## ⚙️ Configuração e Execução

### 1. Instalação das Dependências

Certifique-se de ter o Node.js instalado e execute:

```bash
npm i

```

### 2. Estrutura do Payload (Requisição POST)

Envie uma requisição `POST` para o endpoint da aplicação contendo o JSON com a palavra-chave(ex: desenvolvedor fullstack remoto) desejada e o nome do site:

```json
{
  "keyWord": "Desenvolvedor Full Stack",
  "name": "devvagas"
}

```

### 3. Exemplo de Resposta de Sucesso (`200 OK`)

```json
[
  {
    "title": "Desenvolvedor(a) Full Stack Júnior",
    "url": "https://www.devvagas.com.br/jobs/exemplo-vaga",
    "description": "Requisitos: Experiência com React, Node.js, TypeScript..."
  }
]

```

---

## 🛡️ Filtros de Segurança e Anti-Bloqueio

* **Stealth Plugin**: Oculta assinaturas de automação do Puppeteer para evitar detecção por bots.
* **Tratamento de Overlays**: Remove automaticamente modais, pop-ups e pop-overs indesejados antes de interagir com o DOM.
* **Contorno de Cloudflare**: Inclui rotinas de detecção e clique automatizado em desafios de Cloudflare/Turnstile (como no Glassdoor).
