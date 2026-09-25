# Leve 🌱 — seu diário de emagrecimento

App pessoal de contagem de calorias, **gamificado**, com **alimentos brasileiros** (tabela TACO), que roda **no seu celular**. Sem anúncios, sem assinatura, sem cadastro. **Seus dados ficam só no seu aparelho** — nada vai para a internet.

É um **PWA** (Progressive Web App): funciona como um app instalado, offline, mas é só uma página web — dá pra rodar sem instalar nada técnico.

---

## 📱 Como usar no celular (instalar na tela inicial)

O app precisa ser servido por um endereço `https://` (ou `localhost`) para funcionar como app instalável. Duas formas fáceis:

### Opção A — GitHub Pages (grátis, recomendado)
1. No GitHub, vá em **Settings → Pages**.
2. Em *Source*, escolha a branch onde está o app e a pasta **/ (root)**. Salve.
3. Em ~1 minuto o GitHub te dá um endereço tipo `https://seuusuario.github.io/fitness-project/`.
4. Abra esse endereço **no navegador do celular** (Chrome no Android, Safari no iPhone).
5. **Android/Chrome:** menu ⋮ → *Adicionar à tela inicial*.
   **iPhone/Safari:** botão *Compartilhar* → *Adicionar à Tela de Início*.
6. Pronto — vai aparecer o ícone do Leve como um app. Abra por ali; funciona offline.

### Opção B — testar rápido no computador
Na pasta do projeto:
```bash
python3 -m http.server 8080
```
Abra `http://localhost:8080` no navegador.

---

## 🍽️ O que ele faz

- **Meta calórica personalizada** — calculada a partir do seu perfil (fórmula Mifflin-St Jeor) e do ritmo de emagrecimento que você escolher.
- **Registro rápido de refeições** — busca em **597 alimentos brasileiros** da TACO, com favoritos, criação dos seus próprios alimentos e pratos salvos.
- **Leitor de código de barras** 📷 — escaneie produtos industrializados e o app busca os dados na base aberta **Open Food Facts** (você só confere a quantidade). O produto lido fica salvo para reuso e funciona offline depois.
- **Preferências alimentares** — estilo (onívoro/vegetariano/vegano) e itens a evitar (lactose, glúten, etc.), com avisos na busca.
- **Acompanhamento de calorias e macros** (proteína, carbo, gordura) e **meta de água**.
- **Gamificação** — sequência de dias (streak 🔥), XP, níveis e conquistas.
- **Progresso de peso** — registro, gráfico de evolução, IMC e previsão de chegada à meta.
- **Lembretes** por notificação (café, almoço, jantar, água).
- **Backup** — exportar/importar seus dados num arquivo.

---

## 🔒 Privacidade e seus dados

Tudo é salvo **localmente** no navegador do seu celular (armazenamento do próprio aparelho). O app **não** envia nada para nenhum servidor. A única exceção é o **leitor de código de barras**: ao escanear, o app consulta a base aberta Open Food Facts enviando **apenas o número do código de barras** (nenhum dado seu). Você só usa isso se quiser.

⚠️ **Importante:** como é local, se você **trocar de celular, limpar os dados do navegador ou desinstalar**, os dados s0mem. Por isso existe o **backup**: em *Ajustes → Seus dados → Exportar backup*, salve o arquivo `.json` de vez em quando (no Drive, e-mail para você mesma, etc.). Para restaurar num aparelho novo, use *Importar backup*.

---

## ⏰ Sobre os lembretes (limitação honesta)

Notificações de PWA são confiáveis principalmente com o **app aberto ou recém-fechado**. Com o celular guardado por muitas horas, alguns navegadores atrasam ou não disparam lembretes agendados — isso é uma limitação da plataforma para apps que rodam 100% locais (sem um servidor de push). Ainda assim ajudam bastante no uso do dia a dia.

---

## 📸 Foto do prato (fase 2)

O reconhecimento de comida por foto **não** está incluído nesta versão. É a parte tecnicamente mais difícil e imprecisa, e exigiria enviar a imagem para uma IA na nuvem (o que quebraria o "100% local"). A estrutura do app foi pensada para receber isso como um extra opcional no futuro, se você quiser.

---

## 🧾 Créditos e avisos

- **Base de alimentos:** Tabela Brasileira de Composição de Alimentos — **TACO, 4ª edição (NEPA/UNICAMP, 2011)**. 597 alimentos, valores por 100 g de porção comestível. JSON de origem sob licença MIT (`marcelosanto/tabela_taco`).
- **Produtos com código de barras:** dados da **Open Food Facts** (open.foodfacts.org), base colaborativa sob licença ODbL. Leitura de código feita com a biblioteca **ZXing** (Apache-2.0), quando o navegador não tem leitor nativo.
- Este é um app **pessoal e informativo**. **Não substitui** orientação de nutricionista ou médico. Metas calóricas são estimativas.

---

## 🛠️ Estrutura do código

```
index.html              casca do app
manifest.webmanifest    metadados do PWA (nome, ícones)
sw.js                   service worker (offline + notificações)
css/app.css             estilos (tema claro e escuro)
data/foods.json         base TACO enxuta (597 alimentos)
icons/                  ícones do app
js/
  app.js         inicialização
  store.js       estado + salvamento local + backup
  nutrition.js   cálculo de meta (Mifflin-St Jeor) e macros
  foods.js       base de alimentos, busca, preferências
  gamify.js      XP, níveis, streak, conquistas
  reminders.js   lembretes por notificação
  barcode.js     leitor de código de barras + Open Food Facts
  vendor/zxing.js  biblioteca de leitura (fallback p/ iPhone/Safari)
  ui.js          todas as telas e interações
```

Código 100% estático: **não precisa de build nem de servidor** para funcionar. Feito para ser fácil de manter e ajustar.
