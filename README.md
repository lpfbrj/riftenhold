# Riften Hold — Sistema de Gestão da Corte de Riften

Aplicação web para o Jarl e a Corte administrarem o Hold de Riften em servidor de Skyrim RP.
O sistema tem **três portas**:

| Porta | Quem entra | Com o quê | O que vê |
|---|---|---|---|
| **Corte de Riften** | Jarl e a Corte | e-mail + senha da Corte | tudo |
| **Cidade de Riften** | qualquer morador aprovado | ID do jogo + senha da Corte | a própria ficha, os comércios, o quadro de avisos — mais Dinastia e Propriedades, se tiver |
| **Quartel General** | morador que está alistado | as mesmas credenciais | ficha militar, prisões e logística |

Dentro da Corte o menu tem três seções:

- **Administração** — Palácio do Jarl, Emissão de Licenças
- **Quartel General** — Exército de Riften, Registro de Prisões, Logística
- **Registros** — Registro Civil, Comércios, Trabalhadores

### Como o morador ganha acesso

1. Ele se cadastra pela porta **Cidade de Riften** → *Fazer o Registro Civil*. O pedido
   entra como **Pendente** e não vale nada ainda.
2. A Corte aprova na tela do Registro Civil. **No instante da aprovação nasce uma senha**
   no formato `RFT-K7QM-284`, mostrada num quadro para quem aprovou — é ela que a pessoa
   da Corte entrega em mãos ao morador.
3. Com o **ID do jogo** e essa senha, o morador entra na Cidade de Riften.
4. Se a Corte o alistar no Exército, essas mesmas credenciais abrem também o
   **Quartel General**. Sem alistamento, o Quartel recusa a entrada e diz o porquê.

A senha ignora maiúsculas e hífens (`rftk7qm284` entra igual a `RFT-K7QM-284`) para que
dê para ditar em voz alta. Quem perder a senha recebe outra pelo botão **Emitir senha
nova** — a antiga deixa de valer na hora. A qualquer momento a Corte reabre as credenciais
de um cidadão pelo botão da chave, na lista do Registro Civil.

---

## Rodar em 30 segundos (modo demonstração)

```bash
npm install
npm run dev
```

Sem `.env` configurado o app entra em **modo demonstração**: os dados ficam apenas no
navegador de quem abriu, já com os registros da planilha carregados.

Atalho para testar: entre na Corte com **`Jarl`** / **`123`**.

Pela porta **Cidade de Riften** (e **Quartel General**), três moradores já aprovados,
todos com a senha **`123`**:

| ID do jogo | Quem é |
|---|---|
| `Sophia` | Moradora com casa registrada no nome |
| `Aldric` | Patriarca da Casa Blackwing, com a mesnada Ordem do Dragão Negro |
| `Varek` | Capitão do Exército — é o único que abre o Quartel General |

Contas de demonstração da Corte (senha `mistveil` em todas):

| E-mail | Papel |
|---|---|
| `jarl@riften.rift` | Jarl (acesso total) |
| `mao@riften.rift` | Lorde Mão |
| `comandante@riften.rift` | Lorde Comandante |
| `moeda@riften.rift` | Mestre da Moeda |
| `mago@riften.rift` | Mago da Corte |
| `alquimista@riften.rift` | Alquimista da Corte |

---

## Colocar no ar de verdade (Supabase + Vercel)

### 1. Banco

1. Crie um projeto em [supabase.com](https://supabase.com) (plano gratuito basta).
2. **SQL Editor** → cole e rode `supabase/schema.sql` inteiro.
3. **SQL Editor** → cole e rode `supabase/seed.sql` (carrega os registros da planilha).
4. **Authentication → Providers → Email** → **desligue** "Enable signup".
   Ninguém deve conseguir criar conta de Corte sozinho.

> O Registro Civil é público de propósito: o `schema.sql` cria a política
> `civis_envio_publico`, que deixa qualquer visitante **inserir** um pedido com status
> `Pendente` — e só isso. Ler, editar e apagar continuam restritos à Corte. Se um dia
> aparecer envio em massa, remova essa política e o cadastro passa a ser só pela Corte.

### 2. Contas da Corte

Para cada membro, em **Authentication → Users → Add user** (e-mail + senha).
Copie o UUID gerado e rode no SQL Editor:

```sql
insert into public.perfis (id, nome, cargo, papel)
values ('<uuid-do-usuario>', 'Nome do personagem', 'Jarl', 'jarl');
```

`papel` aceita `jarl` (pode gerir os acessos) ou `corte` (usa tudo, não mexe em contas).
Para suspender alguém sem apagar: `update public.perfis set ativo = false where id = '...';`

### 3. Frontend

```bash
cp .env.example .env      # preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm run build             # gera dist/
```

Suba a pasta `dist/` na Vercel, Netlify ou Cloudflare Pages (as três têm plano gratuito).
Na Vercel: importe o repositório, framework **Vite**, e cadastre as duas variáveis de
ambiente em *Settings → Environment Variables*.

> A chave `anon` é pública por natureza — quem protege os dados é o RLS do `schema.sql`,
> que bloqueia qualquer leitura de quem não tem perfil ativo.

---

## O que cada tela faz

### Portal de entrada

A primeira tela oferece dois caminhos. **Corte de Riften** leva ao login de sempre.
**Registro Civil** abre o formulário público — sem senha, sem cadastro prévio.

### Registro Civil (o morador)

O morador informa nome do personagem, **ID do jogo** (que ele pega no jogo em
*tecla K → aba CONTA → CONFIG*), raça, profissão e nível do ofício. Ao enviar, recebe um
recibo com os dados e o pedido entra na fila da Corte — **nada vai direto para a lista
oficial**. Um mesmo ID de jogo não pode ser registrado duas vezes.

### Registro Civil (a Corte)

A aba mostra a **fila de aprovação** com cada pedido: dados declarados, o recado que o
morador deixou, e três ações — *Aprovar*, *Ajustar antes* (corrigir e então aprovar) e
*Recusar* (com motivo, que fica arquivado). O menu lateral marca em âmbar quantos pedidos
esperam resposta.

Abaixo fica a **lista oficial** de cidadãos reconhecidos, com busca por nome ou ID. Um
cidadão aprovado que declarou ofício ganha o botão **Contratar**, que cria a ficha de
trabalhador já preenchida.

### O registro alimenta o resto do sistema

Onde antes se digitava um nome solto, agora há busca no Registro Civil — em
**Trabalhadores**, no **Exército**, no **proprietário** de uma propriedade, nos **cargos da
Corte**, nos **membros das dinastias** e no **titular de uma licença**. Digite as primeiras
letras do nome (ou o ID) e escolha: raça, ofício, nível e ID do jogo vêm junto, e a ficha
fica vinculada ao cidadão. Nomes de fora do registro continuam aceitos — é só digitar e seguir.

### Perfil do cidadão

Como tudo aponta para o mesmo cadastro, dá para ver a pessoa inteira num lugar só. Clique
no nome em qualquer lista — Registro Civil, Trabalhadores, Exército — e o perfil reúne:

- identidade e ID do jogo, com os papéis dela no Hold em selos (Corte, Nobre, Lorde,
  patente militar, ofício, Proprietário, Licenciado);
- cargo na Corte, se ocupa algum;
- casa nobre a que pertence, e se a lidera;
- vilarejos de que é Lorde nomeado;
- ficha militar com patente, divisão e aptidão;
- ofício e nível;
- todas as propriedades de que é dono, com a catalogação de cada uma;
- todas as licenças emitidas em seu nome;
- **ficha criminal** — cada prisão, com crime, artigo, pena, procedência e o guarda que
  registrou.

Cada bloco vazio diz o que falta ("Não consta no Exército de Riften"), então o perfil também
serve de checklist.

### Emissão de Licenças

Autorizações concedidas pela Corte. Hoje existe a **Licença de Mineração**, que habilita:

- **Cobertura** — Exploração dos Veios de Minérios e/ou Exploração das Minas.
- **Minérios autorizados** — Ferro, Coríndon, Mercúrio, Prata, Ouro, Oricalco, Pedra da Lua,
  Malaquita e Ébano, cada um marcado individualmente e com a cor do minério.
- **Direito a escolta** — se a licença dá direito a acompanhamento da Guarda até o veio ou a
  mina. Depende de quem emite e do acordo.

Cada licença ganha número próprio (`LIC-MIN-0001`), guarda quem a emitiu, e pode ser
**suspensa**, **reativada** ou **revogada** sem perder o histórico.

Para criar um tipo novo de licença (pesca, comércio, caça), acrescente uma entrada em
`TIPOS_LICENCA` (`src/lib/constants.js`) com suas coberturas e recursos — a tela se adapta
sozinha e o banco não precisa mudar.

### Quadro de Avisos

A ferramenta geral do Hold, e a única tela que **as três portas compartilham**. A Corte
publica ali e a publicação chega a todo mundo que tem registro em Riften — morador ou
soldado, cada um vê no acesso dele.

A estrutura é a mais simples possível: **título, data da publicação e texto**. A data é
gravada no momento em que a Corte publica. Só a Corte publica, edita e retira avisos; os
demais leem.

Além das publicações gerais, o quadro carrega os **recados pessoais** que o próprio sistema
emite — quando a Corte recusa a entrada de alguém numa casa nobre, por exemplo, quem indicou
recebe o recado com o motivo, e mais ninguém enxerga aquilo. Aprovações também são avisadas.
Na visão da Corte os recados pessoais aparecem num quadro à parte, com o nome de quem os
recebeu.

### Palácio do Jarl

**Cargos da Corte** — os seis cargos (Jarl, Lorde Mão, Lorde Comandante, Mestre da Moeda,
Mago da Corte, Alquimista da Corte), todos começando vagos. Para criar um cargo novo,
acrescente uma linha em `CARGOS_CORTE` (`src/lib/constants.js`).

**Casas & Dinastias Nobres** — cada casa é um cartão clicável que abre a ficha da dinastia:
brasão (envie um PNG/JPG, o app redimensiona), cor do estandarte, o chefe da casa e a
**lista de membros**. O chefe e cada membro são procurados **no Registro Civil** — digite
parte do nome ou o ID do jogo e escolha na lista; escolher já traz raça e ID junto, e é o
que amarra a pessoa à ficha dela. A lista começa vazia; cadastre as casas de vocês.

Chefe de casa é **Patriarca** ou **Matriarca**, e nada além disso — não existe Regente,
Conselho nem título inventado. Isso é liderança, não é título de nobreza.

**Nobreza de Riften** — a lista de nobres, num quadro à parte logo abaixo das casas. Ela não
é uma tabela separada: sai das próprias dinastias. Toda pessoa vinculada a uma casa — o
Patriarca ou Matriarca e cada membro — aparece aqui com **Nome / Família / Título**, e some
daqui se sair da casa.

Os títulos são **Nobre, Lorde, Lady e Thane**. Todo mundo entra como *Nobre*; elevar é ato
da Corte, e se faz na ficha da casa. O título de liderança **não** ocupa
a coluna Título: o Patriarca conta como Nobre (ou Lorde, se a Corte o elevar) e leva um selo
*Patriarca da Dinastia* ao lado do nome — os demais levam *Membro da Dinastia*. A lista é
enxuta de propósito: nome, família, título e o vínculo com a dinastia, nada de ID nem raça.
Dá para filtrar por título e por família, e clicar no nome abre o perfil completo da pessoa.

Quem não pertence a casa nenhuma é **Plebeu** — não aparece nesta lista, e a ficha dele diz
isso com todas as letras. No rodapé do quadro fica uma lista à parte dos **servos das casas**:
eles servem a uma dinastia mas não são nobres, então ficam fora da tabela da Nobreza e
constam ali só para a Corte saber quem serve a quem.

As indicações que os Patriarcas mandam da Cidade de Riften **chegam nesta mesma lista**, em
cima, como linhas *aguardando aval* — não há quadro separado para isso. Cada linha traz quem
foi indicado, a casa, quem indicou, o parentesco e a justificativa. **Aprovar** faz a pessoa
entrar na dinastia como *Nobre* e virar linha normal da lista; **Recusar** pede um motivo,
tira o pedido da lista e manda um recado a quem indicou pelo Quadro de Avisos.

O **título de cada nobre não se edita aqui**: quem muda Nobre para Lorde, Lady ou Thane é a
ficha da casa, em *Casas & Dinastias Nobres*. A lista tem um botão que leva direto até lá.

**Vilarejos & Lordes Nomeados** — só Ivarstead e Shor's Stone; Riften é a sede do Jarl, não
um vilarejo com Lorde nomeado. Cada um é um cartão clicável que abre a administração:
o Lorde responsável, a **catalogação do território** e as **propriedades que existem ali** —
inclusive as casas. Clicar numa propriedade abre a ficha completa dela, sem sair do vilarejo.

O Lorde é procurado **no Registro Civil**, como todo nome no sistema. E daí sai uma coisa
que ninguém precisa cadastrar: **a casa que detém o vilarejo é a casa do Lorde empossado**.
Empossou alguém da Casa Corvo-Negro, o cartão do vilarejo passa a levar a tag *Casa
Corvo-Negro*, com a cor do estandarte. Trocou o Lorde, a casa troca junto; se o Lorde não
pertence a dinastia nenhuma, o vilarejo fica sem estandarte e o cartão diz isso.

A catalogação do território soma o que existe nas propriedades do assentamento, **menos os
inventários de armazenamento**, que ficam só na ficha de cada propriedade. O botão
*Puxar das propriedades* recalcula isso de uma vez quando você acrescenta ou muda alguma.

**Crônica da Corte** — log de tudo que foi editado, por quem e quando.

### Catalogação com ícones

Catalogação não é mais texto solto: cada peça é um item de um catálogo com ícone próprio —
forja, fundição, bancada, pedra de amolar, tanning rack, caldeirão, laboratório de alquimia,
santuário, inventários, ninhos, colmeias, trigo, batata, repolho, cabaça, alho-poró, raiz de
Nirn, mina de ferro, veio de minério, poço e mais.

No editor você escolhe o item por ícone, agrupado por categoria (Oficina, Armazenamento,
Cultivo, Criação, Recurso, Culto), ajusta a quantidade com + e −, e pode anotar um detalhe
(ex.: santuário **de Dibella**, bancada **Simple**). A mesma interface vale para propriedades
e para o território do vilarejo.

Para acrescentar um tipo de item novo, inclua um objeto em `TIPOS_ITEM`
(`src/data/itens.js`) com um `id`, um `nome`, a categoria e o traçado SVG do ícone.

### Exército de Riften

Registro militar com as 25 perícias da planilha, divididas em Armas de Uma Mão, Armas de
Duas Mãos, Armaduras e Magias. Cada ficha calcula uma **Aptidão** (0–100%) a partir dos
níveis. Filtros por patente, afiliação, divisão e status.

### Registro de Prisões

Onde a Guarda comunica cada prisão. O guarda informa o preso (com busca no Registro Civil),
a **procedência** — os nove Holds: Windhelm, Falkreath, Solitude, Morthal, Dawnstar,
Markarth, Riften, Whiterun e Winterhold — e o **motivo**,
escolhido no **Código de Riften**. Escolher o crime já traz a pena prevista: tempo de prisão,
multa e fiança em Septims. O tempo pode ser ajustado, e o sistema avisa quando difere do
previsto, para o guarda justificar no relato.

Data e hora são gravadas no momento do registro, e o **cronômetro da pena começa a correr
na hora**. A cela mostra a contagem regressiva e uma barra de progresso; quando zera, o
cartão muda para "PENA CUMPRIDA" e aparece o botão **Registrar pena cumprida**. O registro
sai das celas e fica no histórico como *Sentença cumprida*.

Se o crime admite fiança, há também **Soltar sob fiança** durante a pena. O botão
*Consultar o Código* abre a tabela completa das penas, para consulta na hora.

O Código está transcrito em `src/data/codigo.js` — 29 crimes em seis seções (Crimes Leves,
Graves e Hediondos, Das Armas, Das Minas e Do Comércio). Mudou a lei? É esse arquivo que se
edita, e as telas acompanham.

### Logística

Entrada e saída do almoxarifado do Quartel General. Nada de estoque digitado à mão: o saldo
de cada item é sempre a **contagem-base do inventário mais as entradas, menos as saídas**.
Cada lançamento pede quantidade, motivo e destino (ou origem), e grava data, hora e quem
registrou. O formulário mostra o saldo antes e depois, e **trava a baixa** que passar do que
existe em estoque. Clicando no nome do item abre o **extrato**: total que entrou, total que
saiu e a lista dos movimentos.

Três painéis:

- **Equipamentos da Guarda** — as 13 peças fixas do fardamento, conferidas peça a peça no
  baú do Quartel, com tipo (*Body, Head, Hands, Feet, Cloak, Shield*), classe (*Armadura
  Pesada, Armadura Leve, Roupa*), peso, valor e quantidade. Variantes Lendárias somam na
  peça comum — é a mesma peça, e o que vale é a conta. Mais o **arsenal**: os seis materiais
  autorizados (Ferro, Aço, Élfico, Cristal, Nórdico, Ébano), cada um com adaga, espada,
  machado de guerra, maça, espadão, machado de batalha, martelo de guerra, arco e flechas.
  Ferro e Aço não têm arco na forja de Skyrim, então essa linha não aparece nesses dois.
  Nada dáedrico, por decisão da Corte.
- **Poções e Ingredientes** — poções de Vida, Magia e Vigor nos seis degraus do jogo
  (*Minor, comum, Plentiful, Vigorous, Extreme, Ultimate*), e os ingredientes que as
  produzem, marcados com o efeito a que servem. Um mesmo ingrediente pode servir a mais de
  um eixo.
- **Recursos e Insumos** — os nove minérios da Licença de Mineração, os lingotes que saem da
  fundição, as peles e o couro.

O catálogo é fixo e vive em `src/data/almoxarifado.js`; só os movimentos vão para o banco.

### Cidade de Riften — a ficha do morador

O que o morador vê ao entrar. **Ele edita** nome, raça, profissão, nível e o recado que
quer deixar para a Corte — e só isso: o ID do jogo fica travado (é o login dele), e
situação, observação da Corte e nomeações continuam sendo decisão da Corte.

**Ele consulta**, sem poder mexer: o **cargo na Corte** (com a atribuição do cargo escrita
por extenso, ou o aviso de que não tem assento), a **Nobreza** — o título dele e a casa a que
pertence, com brasão, ou *Plebeu* se não pertence a nenhuma —, propriedades em seu nome com a
catalogação de cada uma, ofício e nível, ficha militar resumida, licenças emitidas com
cobertura e minérios autorizados, **multas** — o que o Código cobrou dele em cada prisão, com
o total em aberto — e a **ficha criminal** completa.

Quem responde por um vilarejo vê também o quadro **Vilarejo sob minha responsabilidade**,
com o nome do lugar, quantas propriedades existem ali e a casa sob cujo estandarte ele ficou.

Nada disso é digitado duas vezes: entrou numa casa, o título aparece na ficha; foi nomeado
Lorde Mão, o cargo aparece na ficha; foi empossado em Ivarstead, o vilarejo aparece na ficha.
É o mesmo dado, lido de onde ele mora.

### Cidade de Riften — a Dinastia do Patriarca

Quem chefia uma casa ganha uma segunda aba ao entrar na Cidade de Riften: **Dinastia**. Ela
só aparece para o Patriarca ou a Matriarca daquela casa — mais ninguém a enxerga.

**O que é dele para cuidar**, sem pedir nada a ninguém:

- o **brasão** (envia um PNG/JPG, o app redimensiona) e a cor do estandarte;
- o texto sobre a casa — história, lema, o que a dinastia faz no Hold;
- os **servos**.

O nome da casa e o título dele continuam travados: isso é registro da Corte.

**Trazer alguém para a dinastia é outra coisa.** Entrar numa casa é virar nobre de Riften, e
nobreza é ato da Corte — então o Patriarca **indica** e o pedido vai para a fila do Palácio.
Ele diz quem quer trazer (buscando no Registro Civil), o parentesco e por que a Corte deve
aceitar. Enquanto o pedido está pendente, o indicado **não** entra na casa e **não** aparece
na Nobreza. O Patriarca acompanha o próprio pedido na tela dele, vê a decisão e o motivo de
uma recusa, e pode cancelar enquanto ninguém julgou.

**Servos** são o outro lado da casa: quem serve à dinastia sem pertencer à linhagem. O
Patriarca registra e dispensa por conta própria, sem passar pela Corte, porque servo não
ganha título nenhum — ele **continua Plebeu** e fica de fora da Nobreza de Riften. Para cada
um há um campo livre de **função**, escrito com as palavras do próprio Patriarca: Guarda,
Mordomo, Emissária, Mestre das barcaças, o que a casa quiser. A ficha do servo mostra a casa
que ele serve e essa função, mas o título dele segue Plebeu.

A Corte enxerga tudo: o quadro da casa, no Palácio, tem o mesmo bloco de servos, e ela
também pode registrar servos por ali.

### Cidade de Riften — as Propriedades do dono

Quem é dono de um comércio ganha a aba **Propriedades**, logo abaixo de Dinastia. Ela só
aparece para quem tem uma — e **funcionários também a enxergam**, com a propriedade em que
trabalham. Quem toca mais de uma casa troca entre elas por abas no topo.

Nome, tipo, local e dono continuam sendo registro da Corte. O que é do dono:

- **Funcionários** — nome (buscado no Registro Civil, o que traz profissão e nível junto) e
  um campo livre de **função**: o que essa pessoa faz nesta casa. Só o dono contrata e
  demite; o funcionário vê a lista.
- **Estoque e lista de preços** — nome do item, quantidade e valor em Septims. É a mesma
  tabela para as duas coisas: controla o que há e mostra por quanto se vende. Dono e
  funcionário mexem.
- **Pedidos dos moradores** — os tickets que chegam da cidade.

### Cidade de Riften — comprar na cidade

Todo morador tem a aba **Comércios**, que é a cidade vista de fora do balcão: cada comércio
com estoque aparece como uma vitrine, com o nome, o tipo, o local, **quem é o dono**, **quem
atende** (com a função de cada um) e os **itens à venda** com preço e quantidade.

**Solicitar pedido** abre a lista de itens; o morador escolhe as quantidades — o campo trava
no que há em estoque — vê o total somado na hora e pode deixar um recado. O pedido vira um
**ticket** na tela de Propriedades do dono e dos funcionários.

Quem atende **aceita** ou **recusa**. Aceitar **baixa o estoque** e manda um recado pessoal
ao comprador no Quadro de Avisos: *procure Fulano em Tal Comércio, em Tal lugar, para
retirar 2× Espada de Aço*. Recusar pede um motivo, não mexe no estoque, e o comprador
também é avisado. Os dois lados acompanham a situação: o comprador na própria aba Comércios,
em *Meus pedidos*.

### Quartel General — o registro do soldado

Patente, afiliação, divisão e situação são do comando: o soldado lê, não muda. As
**25 perícias** são dele — é ele quem treina e quem atualiza, e a aptidão recalcula
enquanto edita, mostrando quanto era antes.

Além da própria ficha, o soldado tem as **mesmas telas de Registro de Prisões e Logística**
que a Corte usa: registra prisão pelo Código, encerra pena cumprida, solta sob fiança,
dá entrada e baixa no almoxarifado. Tudo que ele lança sai assinado com o nome dele.
A diferença é que apagar registro de prisão ou estornar lançamento continua sendo ato da
Corte — o soldado não vê esses botões.

### Comércios do Hold

Estabelecimentos e produção em cartões, cada um com sua catalogação visível de relance.
**Residências não aparecem aqui** — casas, solares, templos e fortes vivem no assentamento a
que pertencem, na tela do Palácio. Destaca o que está sem dono setado.

### Trabalhadores da Cidade

Censo de ofícios com nível e vínculo à propriedade onde trabalha. Mostra quais das 11
profissões ainda não têm ninguém registrado.

## De onde vieram os dados

Tudo vem **exclusivamente da planilha `Gestão Riften Corte`**. Nada foi inventado, e campo em
branco na planilha continua em branco aqui:

- **13 comércios** — as 11 linhas da aba *Comércios* mais Riften Fishery e Riften Warehouse,
  com a catalogação convertida em itens.
- **Situação de cada um** conforme a Corte declarou: *Vaga* para Black-Briar Meadery,
  Elgrim's Elixirs, Haelga's Bunkhouse, Heartwood Mill, Pawned Prawn, The Bee and Barb e
  Vilemyr Inn; *Interditada* para Snow-Shod Farm, Sarethi Farm, Fellstar Farm, Riften Fishery
  e Riften Warehouse; The Scorched Hammer segue *Operante*.
- **4 casas** — Klimmek's, Filnjar's, Odfel's e Sylgja's, ligadas aos seus vilarejos.
- **Território de Ivarstead** — as estruturas e o cultivo da Fellstar Farm (bancada, tanning
  rack, pedra de amolar, bloco de corte, 15 repolhos, 11 batatas, 6 trigos, 4 ninhos), já que
  fazem parte do vilarejo tanto quanto da fazenda.
- **Heartwood Mill, Snow-Shod Farm e Sarethi Farm** ficam fora dos três assentamentos e
  por isso não levam rótulo de local.
- **Organização e proprietário** só onde a planilha os traz: *The Bee and Barb*
  (Clã LockHart / Aerion Graysight) e *The Scorched Hammer* (Eron Halvard).
- **Casas nobres: nenhuma.** A planilha não traz dinastias; cadastre as de vocês.
- **6 cargos**, todos vagos.
- **1 registro militar**: Thuraq Drum, com as 25 perícias.
- **0 trabalhadores** — a aba não tem nenhuma linha preenchida.
- **0 cidadãos** — o Registro Civil nasce vazio; ele se enche pelo portal.
- **0 licenças** e **0 prisões** — esses registros nascem vazios.
- A catalogação de estruturas de *Shor's Stone* (forja, fundição, mina de ferro, bancada,
  pedra de amolar, tanning rack e 2 ninhos) ficou no registro do **vilarejo**, não numa
  propriedade — é assim que a planilha a apresenta.

As listas suspensas (patentes, afiliações, divisões, raças, profissões, níveis e as 25
perícias com seus 4 agrupamentos) foram extraídas das regras de validação de dados da
própria planilha.

Tudo isso vive em `src/data/rift.js`. Editou lá? Rode `npm run seed:sql` para regenerar
`supabase/seed.sql`.

### Mudanças depois que o sistema já está em uso

Alterar `rift.js` só afeta instalações novas — quem já usa o app tem os dados no banco (ou no
navegador, em demonstração). Para propagar uma correção sem perder o que já foi cadastrado:

- **Modo demonstração**: acrescente uma entrada em `MUDANCAS` (`src/lib/db.js`) e suba o
  `VERSAO_SEED`. Ela roda uma vez por navegador, mexe só nos registros nomeados ali, e o
  resto do que vocês cadastraram fica intacto.
- **Supabase**: rode `supabase/seed.sql` de novo. A inserção de propriedades pula o que já
  existe (compara pelo nome), então não duplica. O bloco *Situação declarada pela Corte*,
  no fim do arquivo, reescreve a situação das propriedades listadas — use na carga inicial e
  nas correções; no dia a dia, mude pela tela.

## Estrutura

```
src/
  lib/constants.js   enums do domínio (perícias, patentes, cargos, tipos)
  lib/supabase.js    cliente; decide entre Supabase e demonstração
  lib/db.js          CRUD com a mesma API nos dois modos
  lib/auth.js        login e verificação de assento na Corte
  lib/store.jsx      contexto React com os dados carregados
  lib/imagem.js      reduz o brasão antes de guardar
  lib/perfil.js      cruza os registros e monta o perfil de uma pessoa
  data/rift.js       registros vindos da planilha
  data/itens.js      catálogo de itens da catalogação (com os ícones)
  data/codigo.js     Código de Riften: crimes, penas, multas e fianças
  components/        UI, catalogação, ficha de propriedade, busca civil e perfil do cidadão
  pages/             Portal, RegistroPublico, Login e as sete telas da Corte
supabase/
  schema.sql         tabelas, RLS e triggers
  seed.sql           catálogo inicial (gerado)
scripts/
  gerar-seed.mjs     regenera o seed a partir de src/data/rift.js
  smoke.mjs          teste de fumaça com Playwright
```

## Próximos passos sugeridos

- Importar a planilha direto pela interface, em vez de editar `rift.js`.
- Novos tipos de licença: pesca, comércio, caça, porte de arma.
- Tributos: valor por propriedade e fechamento mensal do Mestre da Moeda.
