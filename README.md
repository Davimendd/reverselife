# Reverse Life

Site de apoio a mesas de RPG de terror: campanhas com fichas de personagem, inventário, dano, regras opcionais e **rolagem de dados dentro de cada campanha** (D6 ou D20 + atributos), com histórico compartilhado em tempo real. Visual preto e vermelho, estilo terminal/glitch.

## Arquivos

- `index.html` — estrutura da página (abas, modais, terminal, campanhas)
- `style.css` — identidade visual (preto/vermelho, terminal, glitch no título)
- `firebase-config.js` — onde você cola as credenciais do seu Firebase
- `firebase-core.js` — inicialização compartilhada do Firebase (Firestore + Storage)
- `identity.js` — login, criar conta e sessão (Firebase Authentication)
- `rules.js` — regras puras do jogo: atributos, estados do corpo, sangramento, testes de D20 e ervas
- `dice-data.js` — tabelas do D6, compartilhadas entre o dado global e o das campanhas
- `sound.js` — efeitos sonoros sintetizados (sem arquivos de áudio)
- `app.js` — lógica do dado, animação e feed em tempo real
- `campaigns.js` — lógica de campanhas, personagens, dano, ferimentos, inventário e fome/sede
- `manifest.json` — metadados do app instalável (PWA): nome, cores, ícones
- `sw.js` — service worker: cacheia os arquivos do site pra abrir mais rápido e funcionar offline
- `pwa.js` — registra o service worker
- `icons/` — ícones do app em vários tamanhos (gerados no mesmo estilo visual do dado do site)

## Notificações

Um ícone de sino (🔔/🔕) no topo da página liga ou desliga notificações do navegador para quem estiver com uma campanha aberta. Quando ativadas, a pessoa é avisada automaticamente quando:

- o **dano** de uma ficha que ela criou muda (subiu ou desceu);
- a **fome** ou a **sede** de uma ficha que ela criou diminui — com um aviso especial quando chega a zero;
- um **item novo** aparece no inventário de uma ficha que ela criou;
- **qualquer personagem da campanha morre** (chega a 100% de dano) — essa notificação vale pra todo mundo com a campanha aberta, não só pra quem criou a ficha.

**Como ativar:** clique no sino no topo da página; o navegador vai pedir permissão de notificação. Depois de concedida, clicar de novo no sino liga/desliga o aviso sem precisar mexer nas configurações do navegador.

**⚠️ Limitação importante:** como o site não usa nenhum serviço pago de push (Firebase Cloud Messaging exigiria o plano Blaze), essas notificações só funcionam **enquanto o site estiver aberto em alguma aba do navegador** — mesmo que essa aba esteja em segundo plano (minimizada, em outra aba, com a tela do celular bloqueada em alguns casos) — e com a campanha em questão aberta nela. Elas **não** funcionam com o navegador/app totalmente fechado. Para notificações de verdade com o app fechado, seria necessário migrar para o plano pago do Firebase e implementar push notifications de servidor — o que fica fora do escopo atual.

## Instalar como app (PWA)

O site pode ser adicionado à tela inicial do celular (ou instalado no computador) e abrir como se fosse um app nativo, sem barra de endereço do navegador.

**Requisito importante:** PWAs só funcionam servidos via **HTTPS** (ou `localhost` durante testes) — não funciona pelo `file://` nem por HTTP puro. Qualquer hospedagem HTTPS normal (Firebase Hosting, Vercel, Netlify, GitHub Pages) já atende isso.

**Android (Chrome):** ao visitar o site, aparece um banner ou o menu (⋮) mostra a opção **"Instalar app"** / **"Adicionar à tela inicial"**.

**iPhone/iPad (Safari):** toque no ícone de compartilhar (□ com uma seta) → **"Adicionar à Tela de Início"**. O Safari não mostra instalação automática como o Chrome — esse é o único caminho no iOS.

**Computador (Chrome/Edge):** um ícone de instalação aparece na barra de endereço, à direita.

Depois de instalado, o site abre em janela própria, com o ícone do dado vermelho na tela inicial/menu de apps, sem mostrar a interface do navegador.

**Atualizando o site depois de instalado:** (desde a versão `v9`, o service worker busca sempre a versão mais nova na rede e só usa o cache quando está offline, o que evita misturar arquivos antigos e novos depois de uma atualização.) o service worker guarda uma cópia dos arquivos (HTML/CSS/JS) para abrir mais rápido e funcionar minimamente offline. Sempre que você publicar uma alteração no código, abra `sw.js` e aumente o número em `CACHE_NAME` (ex: de `"reverse-life-v1"` para `"reverse-life-v2"`) — isso força quem já instalou o app a baixar a versão nova, em vez de continuar vendo a versão antiga guardada em cache. Sem esse passo, atualizações podem demorar a aparecer para quem já tem o app instalado.

## Como rodar

Basta abrir `index.html` num servidor local (por exemplo, com a extensão "Live Server" do VS Code, ou `python3 -m http.server` na pasta) e acessar pelo navegador. Não pode ser aberto direto com duplo-clique (`file://`) porque o site usa módulos JavaScript (`type="module"`), que exigem `http://`.

**Sem nenhuma configuração**, o site já funciona: as rolagens aparecem no terminal entre abas abertas no mesmo navegador (usando `localStorage`), então dá pra testar tudo sozinho antes de configurar o resto.

## Deixando o terminal compartilhado de verdade (entre qualquer pessoa, de qualquer lugar)

Para que campanhas, fichas e rolagens apareçam para todo mundo — e não só entre abas do seu navegador — é preciso um banco de dados em tempo real. O site já vem pronto para usar o **Firestore do Firebase** (gratuito no plano usado aqui).

Passo a passo:

1. Acesse [console.firebase.google.com](https://console.firebase.google.com) e crie um projeto novo (qualquer nome).
2. No menu lateral, vá em **Build > Firestore Database** e clique em **Criar banco de dados**.
3. Na aba **Regras** do Firestore, cole:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /rolls/{roll} {
         allow read: if true;
         allow create: if request.auth != null;
         allow update, delete: if false;
       }
       match /usernames/{username} {
         allow read: if true;
         allow create: if request.auth != null
                       && !exists(/databases/$(database)/documents/usernames/$(username));
         allow update, delete: if false;
       }
       match /users/{uid} {
         allow read: if request.auth != null && request.auth.uid == uid;
         allow create: if request.auth != null && request.auth.uid == uid;
         allow update, delete: if false;
       }
     }
   }
   ```

   A coleção `usernames` é o que garante que duas contas não consigam escolher o mesmo handle: cada nome vira o ID de um documento, e só é possível criar o documento se ele ainda não existir. A coleção `users` guarda, para cada conta logada (`uid`), qual é o seu handle.

4. Vá em **Build > Authentication** → **Sign-in method** → ative o provedor **E-mail/senha**. Sem isso, ninguém consegue criar conta ou entrar no site.
5. Vá em **Configurações do projeto** (ícone de engrenagem) → role até **Seus apps** → clique no ícone `</>` para criar um app Web.
6. Copie o objeto `firebaseConfig` gerado e cole no arquivo `firebase-config.js`, substituindo os valores `"COLOQUE_AQUI"`.
7. Hospede os arquivos em qualquer lugar que sirva HTML estático (Firebase Hosting, Vercel, Netlify, GitHub Pages etc.) ou rode localmente com um servidor.

Assim que as credenciais forem preenchidas, o site detecta automaticamente e passa a usar o Firestore — o rodapé do site mostra "modo: online (Firebase)" quando isso acontece.

## Login e contas

O site agora exige uma conta de verdade (e-mail + senha via **Firebase Authentication**) para rolar o dado ou mexer em campanhas:

- **Criar conta**: e-mail, senha (mínimo 6 caracteres) e um handle único (3–16 caracteres: letras, números e underscore). O handle continua sendo o nome exibido no terminal e nas fichas.
- **Entrar**: e-mail e senha. A sessão fica salva pelo próprio Firebase — ao recarregar a página ou voltar depois, a pessoa continua logada automaticamente.
- **Esqueci minha senha**: envia um e-mail de recuperação (só funciona com Firebase configurado).
- **Sair**: botão "sair" no topo, ao lado do handle.

Com login de verdade, as permissões de campanha (só o narrador altera dano/kits, etc.) agora são baseadas na conta autenticada (`uid`), não mais só num nome escolhido livremente no navegador — o que torna as regras do Firestore abaixo capazes de aplicar essas permissões de verdade no servidor, e não só esconder botões na interface.

⚠️ **Modo local (sem Firebase configurado):** o site continua funcionando para testes, com um sistema de contas simplificado guardado no `localStorage` — mas as senhas ficam salvas em texto simples no navegador, sem nenhuma segurança real. Use o modo local só para experimentar o site antes de configurar o Firebase; nunca reutilize uma senha de verdade nele.

## Sons

Todos os efeitos são gerados na hora pelo navegador (Web Audio API) — não há nenhum arquivo de áudio no projeto:

- Um "clique" seco toca a cada instante da animação do dado rolando.
- Quando o resultado é o pior possível de cada tabela (🔴 — Morte Instantânea, Ataque Devastador ou Dano no bloco simplificado), toca um alarme de terminal (dois bipes graves + um agudo).
- O ícone de alto-falante no topo da página liga/desliga o som; a preferência fica salva no navegador.
- Por política dos navegadores, o som só é liberado depois do primeiro clique na página (isso já acontece naturalmente ao rolar o dado).

## Sistemas de dado (tabelas de resultado do D6)

A rolagem existe **somente dentro das campanhas**: cada campanha tem o seu painel `/dev/dados`, e todo resultado é registrado no histórico dela. Em campanhas D6, o painel oferece três sistemas de tabela:

- **🎲 Tabela do Dado** — resultado individual para cada face (1 a 6), de Morte Instantânea a Fuga Perfeita.
- **⚙️ Variação Simplificada** — dois blocos: 1–3 é Dano, 4–6 é Escapou.
- **🎯 Dado de Execução** — usado quando o personagem é alcançado e há chance de execução, de Ataque Devastador a Escape Perfeito.

Depois de cada rolagem, a descrição completa do resultado aparece no painel. Quando sai o pior resultado de uma tabela (🔴), toca o alarme de terminal.

## Campanhas de RPG

Uma segunda aba, "📖 Campanhas", funciona como salas: qualquer pessoa pode criar uma campanha (nome, descrição, imagem) e qualquer pessoa que acessar o site pode entrar nela e criar uma ficha de personagem (nome completo, gênero, ponto forte, ponto fraco, foto). Todos os personagens da campanha aparecem para todo mundo.

**Fichas compactas**: cada personagem aparece como uma linha compacta (miniatura, nome, gênero, barra de dano) — clique nela pra expandir e ver traços, ferramenta de dano, ferimentos e inventário. Isso evita ter que rolar a página inteira quando há várias fichas na campanha. Um campo de busca por nome, acima da lista, ajuda a achar uma ficha específica rapidamente.

**Barra de dano (0–100%)**, com faixas de status:
- 0–24%: estável
- 25–49%: ferido
- 50–74%: muito ferido
- 75–99%: estado crítico
- 100%: morte

Só quem criou a campanha pode aumentar ou diminuir a barra de dano de qualquer personagem dela.

**Ferimentos e limitações**: um campo de texto livre na ficha, editável por quem criou a campanha OU por quem criou aquela ficha específica.

**Editar ficha**: quem criou uma ficha pode editá-la depois de pronta — nome completo, gênero, ponto forte, ponto fraco e foto — através do botão "✎ editar" que aparece no topo do card. Ao trocar a foto, a antiga é substituída; deixando o campo de foto em branco, a foto atual é mantida. Dano, ferimentos e inventário continuam com suas próprias regras de permissão, separadas dessa edição.

**Inventário**: cada ficha tem uma lista de itens (nome, descrição, quantidade e categoria — 🍗 alimento, 🥤 bebida, 🗡️ arma, 🎒 equipamento ou 💉 cura). Só o narrador pode adicionar itens, aumentar/diminuir a quantidade ou excluir um item. Tanto o narrador quanto quem criou a ficha podem **transferir** um item (ou parte da quantidade) para outra ficha da mesma campanha — como se um personagem entregasse o item a outro. Se a ficha de destino já tiver um item com o mesmo nome e categoria, as quantidades somam em vez de duplicar a entrada.

**Sistema de fome e sede (opcional)**: o narrador liga ou desliga esse sistema pra campanha inteira no painel de regras (`/etc/regras.cfg`). Quando ativo, cada ficha ganha duas barras de 3 unidades — 🍗 fome e 💧 sede:
- O narrador pode ajustar cada uma manualmente, ficha por ficha (+/-).
- O narrador também tem dois botões de ação em massa que diminuem 1 de fome ou 1 de sede de **todas as fichas da campanha de uma vez** — útil pra marcar a passagem de um dia, por exemplo.
- Itens de alimento e bebida no inventário ganham um botão **"consumir"** (disponível pro narrador ou pra quem criou a ficha): consumir um alimento dá +1 de fome, consumir uma bebida dá +1 de sede, e reduz a quantidade do item em 1 (removendo-o se chegar a zero).
- **Penalidade por fome/sede zerada**: no mesmo painel, o narrador define uma porcentagem fixa (padrão 10%). Sempre que fome ou sede de uma ficha **já estiver em 0** e for reduzida de novo (manualmente ou pela ação em massa), em vez de tentar ir abaixo de zero, a ficha sofre esse tanto de dano — simulando o desgaste de continuar sem comer ou beber. Se esse dano levar a ficha a 100%, a morte é registrada normalmente.
- Todas essas mudanças ficam registradas no histórico da campanha.

**Histórico de eventos**: cada campanha tem um mini-log próprio, separado do terminal de dados, registrando o que acontece com as fichas ao longo do tempo — mudanças de dano (quem aplicou, quanto e o novo total), uso/adição/remoção de itens do inventário, edições de ferimentos, criação e edição de fichas, e a morte de um personagem ao atingir 100% de dano. Fica visível para todos que entram na campanha, mais recente primeiro.

**Regras opcionais da campanha** (painel `/etc/regras.cfg`, que o narrador usa para ligar/desligar e que pode ser recolhido para ocupar menos espaço):

- 🎲 **Sistema de dados por campanha**: a rolagem acontece somente dentro de cada campanha (painel `/dev/dados`) e o resultado vai pro histórico dela. O narrador escolhe entre **D6** (com as 3 variações de tabela) e **D20 + atributos**.
- **D20 + atributos**: ao criar uma ficha numa campanha D20, a pessoa distribui exatamente **10 pontos** entre Força, Agilidade, Vigor, Carisma e Intelecto (máx. 5 em cada) — depois de criada, não dá mais pra alterar. No painel de dados dá pra rolar um **d20 puro**; pra rolar um **atributo**, o dono da ficha clica no atributo na própria ficha e escolhe o teste (Normal, Difícil ou Arriscado) — a rolagem é automática e o site mostra o total e a conta separada. Todo mundo vê os atributos das fichas da campanha, mas só o dono (ou o narrador, em qualquer ficha) pode rolá-los. Testes: **Normal** (10+), **Difícil** (15+) e **Arriscado** (18+), com sucesso/falha automáticos. Cada ponto de **Vigor** soma +5 ao limite de dano (Vigor 2 = morre em 110%) e desloca na mesma medida os limites entre os estados do corpo.
- 🌀 **Sanidade**: barra de 0 a 100% ajustada pelo narrador; ao chegar em 100% a ficha fica **insana** (perde o juízo, não luta direito, pode ferir colegas e chama atenção) e ganha um visual próprio.
- 🩸 **Sangramento**: liga os estados do corpo ao dano — **Normal** (até 50%), **Mancando** (51–80%) e **No Chão** (81–99%) — e permite ao narrador marcar uma ficha como **Sangrando**: 5% de dano a cada 10 minutos durante 1 hora (30% no total). O desconto é aplicado automaticamente (pelo navegador do narrador ou do dono da ficha que estiver com a campanha aberta; o que passou enquanto ninguém estava online é compensado na próxima abertura). Itens de **cura** e a **Erva Vermelha** encerram o sangramento, e o narrador também pode parar manualmente.
- 🌿 **Ervas** (exigem sanidade ou sangramento ativos): itens prontos (ao adicionar um item, escolha o **item pronto** e nome e descrição curta já vêm preenchidos) — 🌿 **Verde** (restaura vida, usa a mesma % da cura da campanha, mas não para o sangramento), 🌺 **Vermelha** (para o sangramento) e 🫐 **Azul** (restaura 20% de sanidade). O botão **🧪 misturar ervas** (narrador ou dono da ficha) combina **2 ou 3 ervas de cores diferentes**: gasta uma de cada e aplica os efeitos de todas ao mesmo tempo, com **bônus de eficiência** — **+25%** na mistura de 2 e **+35%** na de 3 (arredondado). Com a cura padrão de 30% e a sanidade de 20%: Verde+Vermelha cura **38%** e para o sangramento; Verde+Azul cura **38%** e restaura **25%** de sanidade; Vermelha+Azul para o sangramento e restaura **25%** de sanidade (sem vida); Verde+Vermelha+Azul cura **41%**, para o sangramento e restaura **27%** de sanidade. A cura segue a % de cura configurada pelo narrador (o bônus é aplicado por cima). No formulário, escolha a primeira, a segunda e, se quiser, a terceira erva; o texto abaixo mostra o efeito já com o bônus antes de confirmar.

- 🎒 **Carga pela Força** (só em campanhas D20): cada ficha carrega **5 itens + 2 por ponto de Força** (Força 2 = 9 itens). O limite conta as unidades (3 ervas ocupam 3 espaços). O narrador não consegue adicionar nem aumentar itens além da capacidade, e uma transferência só acontece se a ficha de destino tiver espaço. A ficha mostra o contador 🎒 usados/limite.
- ⚠️ **Desvantagem no D20**: enquanto a ficha estiver **Mancando** ou **No Chão** (sistema de sangramento ativo), **todos os testes dela** — atributos rolados na ficha e o teste de sanidade — saem com desvantagem: o site rola 2d20 e fica com o menor. A ficha avisa isso (selo "⚠️ desvantagem", aviso no estado do corpo e no menu de rolagem) e a desvantagem só acaba quando ela se cura e volta ao estado Normal. O d20 puro do painel não pertence a nenhuma ficha e não sofre desvantagem.
- 🌀 **Teste de sanidade** (botão do narrador, só com a sanidade ativa): o narrador escolhe a dificuldade, o abalo mental (%) e quais fichas participam. O site rola Carisma (1d20 + Carisma; em campanhas D6, 1d20 puro) por cada ficha, aplica o abalo em quem falhar, mostra quem passou e quem falhou e registra tudo no histórico.

Nenhuma regra nova do Firestore é necessária: tudo reaproveita os documentos de campanha, ficha e histórico que já existem.

**Itens de cura**: em vez de um sistema fixo de "kits médicos", a cura agora é só mais uma categoria de item (💉 Cura) no inventário — pode ser qualquer coisa que o narrador queira (um kit de primeiros socorros, um remédio, magia de cura, etc.). Itens dessa categoria ganham um botão **"usar (cura)"**, disponível pro narrador ou pra quem criou a ficha: usar reduz o dano em uma porcentagem fixa (**30% por padrão**) e consome uma unidade do item. Essa porcentagem pode ser ajustada pelo narrador num painel acima da lista de personagens, valendo para todos os itens de cura da campanha.

**⚠️ Sobre segurança:** com login de verdade, as permissões agora são baseadas na conta autenticada (`uid`) e podem ser aplicadas nas regras do Firestore abaixo — não é mais só a interface escondendo botões. Ainda assim, as regras abaixo autorizam a escrita para "narrador da campanha OU dono da ficha" de forma ampla (por simplicidade); elas não distinguem no servidor, por exemplo, que só o narrador pode mexer no dano enquanto o dono da ficha só pode editar ferimentos — essa distinção mais fina continua sendo feita pela interface (que esconde os botões certos para cada pessoa). Para separar isso também no servidor seria necessário usar Cloud Functions ou regras bem mais elaboradas, o que fica fora do escopo de um site estático como este.

**Sobre as imagens:** o Firebase Storage passou a exigir o plano pago (Blaze) para novos projetos, então este site **não usa Storage**. As imagens de campanha e de personagem são redimensionadas no navegador (até 640px ou 480px de lado, JPEG comprimido) e guardadas como texto base64 direto dentro do próprio documento no Firestore — que continua 100% no plano gratuito (Spark). Isso mantém cada documento bem abaixo do limite de 1 MB do Firestore, então não há custo extra além do que você já paga (nada, no plano gratuito) pelas rolagens e contas.

### Regras do Firestore (adicionar às já existentes)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /rolls/{roll} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update, delete: if false;
    }
    match /usernames/{username} {
      allow read: if true;
      allow create: if request.auth != null
                    && !exists(/databases/$(database)/documents/usernames/$(username));
      allow update, delete: if false;
    }
    match /users/{uid} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow create: if request.auth != null && request.auth.uid == uid;
      allow update, delete: if false;
    }
    match /campaigns/{campaignId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update: if request.auth != null && (
        !('creatorUid' in resource.data) ||
        request.auth.uid == resource.data.creatorUid
      );
      allow delete: if false;

      match /characters/{characterId} {
        allow read: if true;
        allow create: if request.auth != null;
        allow update: if request.auth != null && (
          !('creatorUid' in resource.data) ||
          request.auth.uid == resource.data.creatorUid ||
          request.auth.uid == get(/databases/$(database)/documents/campaigns/$(campaignId)).data.creatorUid ||
          request.resource.data.diff(resource.data).affectedKeys().hasOnly(['items'])
        );
        allow delete: if false;
      }

      match /events/{eventId} {
        allow read: if true;
        allow create: if request.auth != null;
        allow update, delete: if false;
      }
    }
  }
}
```

A condição `!('creatorUid' in resource.data)` existe para não travar campanhas/fichas criadas **antes** de o site ter login (elas não têm esse campo salvo) — nesses casos, qualquer pessoa logada ainda consegue editar. Fichas e campanhas criadas depois do login já vêm com `creatorUid` preenchido e passam a valer só para quem criou.

A condição `request.resource.data.diff(resource.data).affectedKeys().hasOnly(['items'])` existe especificamente para a **transferência de itens**: como enviar um item mexe na ficha de quem envia *e* na ficha de quem recebe ao mesmo tempo, essa regra libera qualquer pessoa autenticada a alterar **somente o campo `items`** de qualquer ficha da campanha — sem abrir brecha para mexer em dano, ferimentos ou qualquer outro campo de uma ficha que não seja sua.

Sem Firebase configurado, login, campanhas e personagens funcionam em modo local (localStorage + BroadcastChannel), com as imagens guardadas como base64 — funciona só entre abas do mesmo navegador, ideal para testar antes de configurar.

**Se aparecer "acesso negado pelo Firestore" ao salvar:** normalmente é porque as regras no console do Firebase ainda não foram atualizadas para a versão acima — copie o bloco de novo em **Firestore Database > Regras** e publique. Se o erro persistir, abra o console do navegador (F12) para ver o código de erro exato.

## Como funciona a rolagem

- Entre numa campanha e use o painel `/dev/dados`: no D6, escolha a tabela e clique em **ROLAR D6**; no D20, clique em **ROLAR D20 (PURO)** ou clique num atributo da sua ficha e escolha o teste.
- O resultado aparece no painel e é registrado no histórico da campanha, com o nome de quem rolou.
- A rolagem exige estar logado; só o narrador pode escolher o sistema de dados da campanha (D6 ou D20).
