# Federal Intelligence

Aplicativo independente para acompanhar a Loteria Federal, armazenar concursos no Supabase e analisar os últimos 20 concursos.

## O que está incluído

- Painel web responsivo (HTML/CSS/JavaScript).
- Conexão com Supabase usando a chave pública `anon`/publishable.
- Banco PostgreSQL com concursos, cinco prêmios, análises e log de coletas.
- Edge Function protegida para receber resultados do coletor.
- Coletor experimental com Playwright para ler a página oficial renderizada da Caixa, sem consumir API de resultados.
- Importador CSV para carga inicial/histórica e contingência.
- Workflow do GitHub Actions para execução agendada.

## Importante sobre a coleta

A página oficial da Caixa é dinâmica. O coletor usa navegador Playwright para ler o conteúdo renderizado, não um endpoint de API. Como o HTML/estrutura da página pode mudar e alguns sorteios podem apresentar séries/formatações diferentes, a primeira execução precisa ser validada. O coletor falha de forma fechada: se não identificar concurso, data e exatamente cinco bilhetes, não grava dados.

A página oficial informa que os cinco prêmios principais são bilhetes de cinco algarismos e que milhar, centena e dezena são modalidades derivadas desses prêmios. Fonte: https://loterias.caixa.gov.br/Paginas/Federal.aspx

**Não existe previsão confiável de sorteio.** As frequências mostradas são descritivas dos últimos 20 concursos e não alteram a probabilidade matemática de um resultado futuro.

## 1. Criar o projeto Supabase

1. Crie um projeto no https://supabase.com/.
2. Abra SQL Editor.
3. Execute `supabase/schema.sql`.
4. Em Project Settings > API, copie Project URL e a chave pública (anon/publishable).
5. Configure essas duas informações em `app/config.js`.

Não coloque `service_role` ou segredo do coletor no JavaScript do navegador.

## 2. Configurar a Edge Function

No terminal, dentro da pasta do projeto:

```bash
npm install -g supabase
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase secrets set COLLECTOR_SECRET="uma-chave-longa-e-aleatoria"
supabase functions deploy ingest-resultados
```

A função usa a chave `service_role` do ambiente Supabase no servidor e valida `COLLECTOR_SECRET`. Não exponha esses segredos.

## 3. Configurar o coletor no GitHub Actions

Em Settings > Secrets and variables > Actions, crie:

- `SUPABASE_URL`: URL do projeto.
- `COLLECTOR_SECRET`: mesmo segredo definido na Edge Function.

O workflow `.github/workflows/coleta-federal.yml` executa em agenda e também pode ser iniciado manualmente. A agenda padrão é a cada 30 minutos. O GitHub Actions pode atrasar execuções agendadas; não é um relógio garantido.

## 4. Carga histórica

O projeto não presume que o coletor automático consiga baixar todo o histórico de uma vez. Para a carga inicial, obtenha o arquivo histórico/CSV de uma fonte que permita download e confira os dados com a Caixa. Use o formato:

```csv
concurso,data,primeiro,segundo,terceiro,quarto,quinto
6117,2026-11-11,12345,02346,34567,45678,56789
```

Os números acima são apenas exemplo de formato, não resultados reais.

Execute localmente:

```bash
pip install -r coletor/requirements.txt
python coletor/importar_csv.py historico.csv
```

Defina as variáveis `SUPABASE_URL` e `COLLECTOR_SECRET` no ambiente antes de executar. O importador chama a mesma Edge Function protegida.

## 5. Abrir o aplicativo

Abra `app/index.html` com um servidor local (por exemplo, extensão Live Server do VS Code). Configure `app/config.js`.

Para publicar no GitHub Pages, habilite Pages apontando para a pasta `/app` (ou copie o conteúdo de `app` para a raiz de um repositório dedicado).

## Como interpretar o painel

- Terminação: últimos 2 algarismos.
- Centena: últimos 3 algarismos.
- Milhar: últimos 4 algarismos.
- Cada concurso tem cinco bilhetes principais.
- A janela de análise são os 20 concursos mais recentes.
- “Frequência observada” é contagem histórica, não probabilidade de previsão.
- As sugestões são variáveis: o motor pode retornar poucas ou nenhuma quando não há diferença estatística relevante.

## Próxima validação necessária

Depois de criar o projeto Supabase e inserir as credenciais públicas em `app/config.js`, rode a primeira coleta manual pelo workflow. Confira um concurso recente comparando os cinco bilhetes e a data com a página oficial da Caixa antes de deixar a agenda ativa.
