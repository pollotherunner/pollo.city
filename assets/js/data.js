(function () {
  const POSTS_KEY = "pollo.posts.v1";
  const COMMENTS_KEY = "pollo.comments.v1";
  const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

  const SEED_POSTS = [
    {
      slug: "o-elogio-das-coisas-que-nao-pedem-atencao",
      title: "O elogio das coisas que não pedem atenção",
      excerpt: "Sobre intenção, silêncio e a beleza discreta de uma interface que simplesmente funciona.",
      category: "Design",
      date: "2026-10-18",
      body: `Há uma categoria de interface que quase nunca recebe crédito: aquela que não tenta ser assunto. Você abre, resolve o que precisava e segue com o dia. Nenhum tutorial, nenhuma celebração, nenhuma animação pedindo aplausos.

É um tipo raro de cuidado. Fazer o óbvio exige mais decisões do que parece.

## A boa interface parece inevitável

Um formulário bem desenhado não parece desenhado. Um bom menu não precisa explicar onde fica cada coisa. A hierarquia, os espaços e até o que ficou de fora trabalham juntos para que o próximo passo seja simples.

> O melhor sinal de que uma interface funcionou é o silêncio que ela deixa depois do clique.

Esse silêncio não é ausência de personalidade. É personalidade expressa em hospitalidade: espaço para respirar, palavras claras e nenhum obstáculo desnecessário.

## O detalhe que quase ninguém vê

A maior parte do trabalho de design acontece antes do primeiro pixel. É entender o que a pessoa está tentando fazer, quais são seus medos e o que pode dar errado no caminho.

Alguns gestos pequenos mudam tudo:

- um texto de erro que explica como voltar, em vez de culpar;
- um campo que já vem focado quando existe apenas uma tarefa;
- um botão que mantém o estado visível enquanto a resposta demora;
- uma mensagem de sucesso que fecha o ciclo em vez de deixar a dúvida.

Nenhum desses detalhes ganha prêmio. Todos devolvem tempo.

### Menos aplausos, mais cuidado

Quando uma interface é invisível, é comum que ninguém perceba quanto pensamento existe ali. Mas talvez seja esse o ponto: cuidado não precisa se anunciar. Ele aparece na sensação de que as coisas simplesmente funcionam.

No fim, a melhor homenagem a uma interface discreta não é um elogio. É continuar usando sem pensar nela.`,
    },
    {
      slug: "um-site-pequeno-tambem-e-uma-escolha",
      title: "Um site pequeno também é uma escolha",
      excerpt: "Na internet, fazer menos pode ser um ato de cuidado. Uma defesa das páginas leves e dos projetos que cabem na palma da mão.",
      category: "Ensaios",
      date: "2026-10-11",
      body: `A internet começou como uma coleção de lugares. Depois virou uma avenida com todas as lojas abertas ao mesmo tempo, cada uma tentando puxar a sua manga. Hoje, entrar em um site pode parecer atravessar um aeroporto para chegar a uma padaria.

Talvez por isso os sites pequenos chamem tanta atenção. Eles não competem pelo resto da sua vida. Fazem uma coisa, fazem bem, e devolvem você ao mundo.

## Pequeno não é sinônimo de menor

Um site pequeno pode ser ambicioso. Pode ter personalidade, uma tipografia escolhida com cuidado, textos longos e ideias difíceis. O tamanho aqui não se mede em páginas, mas em intenção.

> Um site pequeno não é um site incompleto. É um site que decidiu terminar.

Essa decisão tem consequências. Sem feed infinito, cada visita tem um fim. Sem personalização, todo mundo vê a mesma coisa. Sem notificação, você precisa lembrar de voltar. Nada disso é uma falha.

## O que cabe na palma da mão

Quando o escopo diminui, sobra espaço para o que importa:

1. uma página que carrega antes da dúvida aparecer;
2. um endereço que você consegue guardar na memória;
3. um visual que não precisa de manual;
4. uma voz que parece de alguém, não de uma campanha.

Vejo isso em cadernos pessoais, listas de links, arquivos de receitas e diários de bordo. Páginas feitas porque alguém queria um lugar para guardar alguma coisa. A web é boa nisso quando a deixamos ser.

### Um ritmo diferente

Fazer um site pequeno é aceitar um ritmo mais lento. Você escolhe uma fonte, escreve um texto, publica. Talvez ninguém encontre na primeira semana. Talvez encontre em 2040, vindo de um link antigo.

Ainda assim, o gesto importa. Toda página independente é uma pequena prova de que a internet não precisa ser apenas um lugar de passagem. Ela também pode ser um lugar onde alguém deixou uma luz acesa.`,
    },
    {
      slug: "html-css-e-o-suficiente",
      title: "HTML, CSS e o suficiente",
      excerpt: "Um lembrete para quando a stack cresce mais do que a ideia: o navegador já sabe fazer muita coisa.",
      category: "Código",
      date: "2026-09-30",
      body: `Toda semana aparece uma ferramenta nova. E toda semana alguém começa um blog com quatro dependências, um gerador de páginas e uma esteira de publicação que ocupa uma tarde inteira. Nada contra ferramentas. Mas às vezes a ideia é menor que a infraestrutura.

Um arquivo HTML, um pouco de CSS e alguns pixels de JavaScript podem resolver uma quantidade absurda de problemas. O navegador já vem com tipografia, links, formulários, navegação e histórico. O resto pode esperar.

## O básico faz mais do que parece

Hoje este site tem três páginas e um arquivo de estilos. Sem framework, sem banco, sem etapa de build. Para um caderno pessoal, isso não é uma limitação: é uma decisão de escopo.

\`\`\`html
<article>
  <header>
    <p class="eyebrow">Diário / 03</p>
    <h1>Uma ideia pequena</h1>
  </header>
  <p>O texto começa aqui.</p>
</article>
\`\`\`

É claro que esse caminho tem custos. Comentários não atravessam navegadores. A busca é simples. O conteúdo criado no painel mora apenas onde foi criado. Enquanto o objetivo é olhar, escrever e experimentar, esses custos são pequenos.

### Alguns sinais de que dá para simplificar

- você está instalando uma biblioteca para formatar uma data;
- o projeto tem mais arquivos de configuração do que telas;
- a página demora mais para carregar do que para ser entendida;
- ninguém sabe exatamente o que uma das dependências faz.

O suficiente não é o mínimo absoluto. É o tamanho certo para o problema de hoje, com espaço para mudar amanhã. Uma escolha pequena, feita com cuidado, costuma envelhecer melhor do que uma grande aposta feita com pressa.

## A web também é artesanato

Gosto da ideia de um site como um móvel de madeira: algumas junções visíveis, marcas de uso, uma peça que você aprendeu a consertar. Não precisa parecer uma fábrica para funcionar.

Escrever HTML é uma forma de colocar as ideias em ordem. O CSS dá ritmo. O JavaScript, quando aparece, existe para resolver uma pequena fricção, não para justificar o próprio espetáculo.`,
    },
    {
      slug: "a-mesa-onde-as-ideias-pousam",
      title: "A mesa onde as ideias pousam",
      excerpt: "Uma volta pela minha mesa, pelos objetos que ficam e pelas coisas que nunca termino.",
      category: "Cadernos",
      date: "2026-09-21",
      body: `Minha mesa não é um editorial de revista. Tem um caderno aberto em uma página de outubro, um copo com marca de café e três canetas das quais só uma funciona. Também tem uma pilha de papéis que comecei a chamar de arquivo, para não precisar organizá-los.

A bagunça não é decoração. É uma forma de memória. Cada coisa parada ali foi deixada no meio de uma ideia.

## Os objetos que ficam

Alguns objetos sobrevivem a todas as limpezas. Um deles é uma régua de metal que comprei para um projeto gráfico e nunca mais usei no projeto. Outro é uma caixa pequena com adesivos que não combina com nada.

- a caneta que funciona, porque escrever à mão acalma;
- o caderno sem pauta, porque a linha chega antes da ideia;
- o copo que esfria esquecido, porque o tempo passa;
- um pedaço de papel com uma frase que ainda não virou texto.

> A mesa é menos um lugar de trabalho e mais uma sala de espera para ideias.

## Começar no meio

Muitas coisas começam aqui sem um começo claro. Um rascunho nasce no meio de uma reunião, um desenho aparece durante uma ligação, uma lista de palavras surge de uma caminhada. A mesa recebe tudo, sem pedir contexto.

Talvez o ideal de uma prática criativa não seja a organização perfeita. Talvez seja ter um lugar onde as coisas possam pousar antes de saber o que são.

No fim do dia, arrumo o que dá. Sobra sempre uma caneta fora do lugar. Amanhã, ela encontra outra ideia.`,
    },
  ];

  const SEED_COMMENTS = {
    "o-elogio-das-coisas-que-nao-pedem-atencao": [
      {
        id: "seed-comment-1",
        name: "Marina Alves",
        body: "Essa ideia de interface como cortesia me acompanhou o dia inteiro. A melhor parte é que não precisa ser uma coisa grandiosa: às vezes é só um texto de erro com educação.",
        date: "2026-10-19T14:32:00",
      },
      {
        id: "seed-comment-2",
        name: "Theo Ramos",
        body: "O trecho sobre intenção me fez lembrar de um app que usei por anos sem nunca pensar no design. Acho que era justamente o elogio que ele merecia.",
        date: "2026-10-20T09:18:00",
      },
      {
        id: "seed-comment-3",
        name: "Ana Beatriz",
        body: "Voltarei a esse texto. E o site está uma delícia de navegar.",
        date: "2026-10-22T18:04:00",
      },
    ],
    "um-site-pequeno-tambem-e-uma-escolha": [
      {
        id: "seed-comment-4",
        name: "Caio Nunes",
        body: "Um site que decidiu terminar. Vou roubar essa frase, com todo o respeito.",
        date: "2026-10-12T11:45:00",
      },
      {
        id: "seed-comment-5",
        name: "Lia Prado",
        body: "Tenho um caderno digital parado há meses justamente porque queria que ele fosse maior. Acho que o problema era outro.",
        date: "2026-10-13T20:12:00",
      },
    ],
    "html-css-e-o-suficiente": [
      {
        id: "seed-comment-6",
        name: "Rafa Moura",
        body: "A parte de instalar uma biblioteca para formatar uma data me atingiu em um nível pessoal.",
        date: "2026-10-01T08:27:00",
      },
    ],
    "a-mesa-onde-as-ideias-pousam": [],
  };

  function readJSON(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      throw new Error("storage-unavailable");
    }
  }

  function parseDate(value) {
    if (!value) return new Date();
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const parts = value.split("-").map(Number);
      return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  function formatDate(value) {
    const date = parseDate(value);
    return `${String(date.getDate()).padStart(2, "0")} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  }

  function formatCommentDate(value) {
    const date = parseDate(value);
    const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    return `${String(date.getDate()).padStart(2, "0")} ${MONTHS[date.getMonth()]} ${date.getFullYear()} · ${time}`;
  }

  function formatLongDate(value) {
    const date = parseDate(value);
    return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getFullYear()).slice(-2)}`;
  }

  function isoToday() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function getCustomPosts() {
    const posts = readJSON(POSTS_KEY, []);
    return Array.isArray(posts) ? posts : [];
  }

  function getPosts() {
    const posts = [...getCustomPosts(), ...SEED_POSTS];
    return posts.sort((a, b) => {
      const dateA = parseDate(a.date).getTime();
      const dateB = parseDate(b.date).getTime();
      if (dateA !== dateB) return dateB - dateA;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }

  function getPost(slug) {
    return getPosts().find((post) => post.slug === slug) || null;
  }

  function slugify(value) {
    return String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "nota-sem-titulo";
  }

  function uniqueSlug(title) {
    const base = slugify(title);
    const existing = new Set(getPosts().map((post) => post.slug));
    if (!existing.has(base)) return base;
    let suffix = 2;
    while (existing.has(`${base}-${suffix}`)) suffix += 1;
    return `${base}-${suffix}`;
  }

  function readingMinutes(body) {
    const words = String(body || "").replace(/[#>*_`\-\[\]()]/g, " ").trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 210));
  }

  function plainExcerpt(body, length) {
    const text = String(body || "")
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/[#>*_`\[\]]/g, "")
      .replace(/\((https?:\/\/[^)]+)\)/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length <= length) return text;
    return `${text.slice(0, length).trim().replace(/[,.;:]$/, "")}…`;
  }

  function addPost(data) {
    const customPosts = getCustomPosts();
    const slug = uniqueSlug(data.title);
    const post = {
      slug,
      title: String(data.title || "").trim(),
      excerpt: String(data.excerpt || "").trim() || plainExcerpt(data.body, 150),
      category: String(data.category || "Cadernos").trim(),
      body: String(data.body || ""),
      date: isoToday(),
      createdAt: Date.now(),
      author: "Pollo",
    };
    customPosts.push(post);
    writeJSON(POSTS_KEY, customPosts);
    return post;
  }

  function getComments(slug) {
    const stored = readJSON(COMMENTS_KEY, {});
    const localComments = Array.isArray(stored[slug]) ? stored[slug] : [];
    const seeded = Array.isArray(SEED_COMMENTS[slug]) ? SEED_COMMENTS[slug] : [];
    return [...seeded, ...localComments].sort((a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime());
  }

  function addComment(slug, data) {
    const stored = readJSON(COMMENTS_KEY, {});
    const comments = Array.isArray(stored[slug]) ? stored[slug] : [];
    const comment = {
      id: `comment-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      name: String(data.name || "").trim().slice(0, 48),
      body: String(data.body || "").trim().slice(0, 800),
      date: new Date().toISOString(),
    };
    comments.push(comment);
    stored[slug] = comments;
    writeJSON(COMMENTS_KEY, stored);
    return comment;
  }

  function initials(name) {
    const pieces = String(name || "?").trim().split(/\s+/).filter(Boolean);
    if (!pieces.length) return "?";
    if (pieces.length === 1) return pieces[0].slice(0, 2).toUpperCase();
    return `${pieces[0][0]}${pieces[pieces.length - 1][0]}`.toUpperCase();
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[character]));
  }

  window.Pollo = {
    formatDate,
    formatLongDate,
    formatCommentDate,
    getPosts,
    getPost,
    getCustomPosts,
    addPost,
    getComments,
    addComment,
    readingMinutes,
    plainExcerpt,
    slugify,
    initials,
    escapeHTML,
    isoToday,
    parseDate,
  };
})();
