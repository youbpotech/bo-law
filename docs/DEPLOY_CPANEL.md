# Deploy em cPanel 136.0.23

Sim, esta aplicacao pode ser publicada em um cPanel 136.0.23, desde que a hospedagem tenha suporte a aplicacoes Node.js habilitado no cPanel/WHM e ofereca PostgreSQL local ou permita conexao com um PostgreSQL externo.

Este projeto tem:

- Frontend: Vue 3 + Vite, publicado como arquivos estaticos gerados em `dist/`.
- Backend: Express + TypeORM + PostgreSQL, publicado como uma aplicacao Node.js.
- API: o frontend chama rotas relativas em `/api`, entao a forma mais simples e deixar frontend e backend no mesmo dominio.

> Referencia: a documentacao oficial do cPanel para o [Application Manager](https://docs.cpanel.net/cpanel/software/application-manager/) informa que a interface e valida para a versao 136, usa Phusion Passenger, pode ser habilitada/desabilitada pelo provedor em WHM, e depende dos pacotes Node.js como `ea-nodejs20` ou `ea-nodejs22`.

## Pre-requisitos no cPanel

Antes de subir, confirme com o provedor ou no proprio cPanel:

1. Existe a opcao **Setup Node.js App** ou **Application Manager**.
2. Existe Node.js 20 ou Node.js 22 disponivel.
3. Existe PostgreSQL disponivel no cPanel, ou voce tem uma URL de banco externo.
4. O dominio tem SSL ativo.
5. Voce tem acesso SSH. Sem SSH ainda e possivel subir arquivos pelo File Manager, mas fica bem mais trabalhoso executar build, instalar dependencias e rodar migrations.

## Estrutura recomendada no servidor

Exemplo usando o dominio `seudominio.com`:

```txt
/home/usuario/
  bo-law-api/            # backend Node.js
  public_html/           # frontend estatico
```

Rotas finais:

```txt
https://seudominio.com/      -> frontend Vue/Vite
https://seudominio.com/api   -> backend Express
```

Se o cPanel nao permitir publicar a aplicacao Node em `/api` no mesmo dominio, use um subdominio:

```txt
https://seudominio.com/      -> frontend
https://api.seudominio.com/  -> backend
```

Nesse caso sera necessario ajustar o frontend para chamar a URL completa da API ou criar um proxy/rewrite no Apache.

## Preparar o projeto localmente

Na raiz do projeto:

```sh
pnpm install
pnpm build
```

Depois desses comandos, os artefatos importantes serao:

```txt
apps/web/dist/    # frontend pronto para upload
apps/api/dist/    # backend compilado
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
apps/
```

## Banco de dados

### Opcao A: PostgreSQL no proprio cPanel

No cPanel, crie:

- Um banco PostgreSQL, por exemplo `usuario_bo_law`.
- Um usuario, por exemplo `usuario_crwuser`.
- Permissao do usuario no banco.

Guarde:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=usuario_crwuser
DB_PASSWORD=sua_senha
DB_NAME=usuario_bo_law
```

### Opcao B: PostgreSQL externo

Use uma variavel unica:

```env
DATABASE_URL=postgres://usuario:senha@host:5432/banco
```

Se o banco exigir SSL e nao for o Render, talvez seja necessario ajustar `apps/api/src/data-source.ts`, porque hoje o SSL so e ativado automaticamente quando a URL contem `render.com`.

## Configurar variaveis de ambiente

No Node.js App/Application Manager do cPanel, configure:

```env
NODE_ENV=production
AUTH_SECRET=troque-por-um-segredo-longo-e-aleatorio
BOOTSTRAP_ROOT_NAME=Administrador
BOOTSTRAP_ROOT_USERNAME=admin
BOOTSTRAP_ROOT_PASSWORD=uma-senha-forte-com-12-ou-mais-caracteres
BOOTSTRAP_ROOT_COMPANY_ID=1
DB_HOST=localhost
DB_PORT=5432
DB_USER=usuario_crwuser
DB_PASSWORD=sua_senha
DB_NAME=usuario_bo_law
```

Ou, usando banco externo:

```env
NODE_ENV=production
AUTH_SECRET=troque-por-um-segredo-longo-e-aleatorio
BOOTSTRAP_ROOT_NAME=Administrador
BOOTSTRAP_ROOT_USERNAME=admin
BOOTSTRAP_ROOT_PASSWORD=uma-senha-forte-com-12-ou-mais-caracteres
BOOTSTRAP_ROOT_COMPANY_ID=1
DATABASE_URL=postgres://usuario:senha@host:5432/banco
```

Nao defina `AUTH_SECRET` curto. Em producao, o backend falha se essa variavel nao existir.

## Subir o frontend

1. Rode localmente:

```sh
pnpm build
```

2. Envie o conteudo da pasta `apps/web/dist/` para:

```txt
/home/usuario/public_html/
```

3. Garanta que o arquivo fique assim:

```txt
public_html/index.html
public_html/assets/...
```

Nao envie a pasta `apps/web/dist` para dentro de `public_html`; envie o conteudo dela.

## Configurar SPA fallback

Como o projeto usa Vue Router com history mode, crie ou edite:

```txt
public_html/.htaccess
```

Com:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  RewriteRule ^api(/.*)?$ - [L]

  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

Isso permite acessar URLs como `/users`, `/companies` e `/settings` diretamente pelo navegador.

## Subir o backend

Crie a pasta:

```txt
/home/usuario/bo-law-api/
```

Envie para ela:

```txt
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
apps/api/
```

Depois, no SSH dentro de `/home/usuario/bo-law-api`:

```sh
pnpm install --prod=false
pnpm build:api
```

Se o cPanel nao tiver `pnpm`, use uma destas alternativas:

```sh
corepack enable
corepack prepare pnpm@latest --activate
pnpm install --prod=false
```

Ou instale com npm:

```sh
cd apps/api
npm install
npm run build
```

## Registrar o backend no cPanel

No **Setup Node.js App** ou **Application Manager**:

1. Crie uma nova aplicacao Node.js.
2. Escolha Node.js 20 ou 22.
3. Defina o ambiente como **Production**.
4. Defina o caminho da aplicacao como:

```txt
bo-law-api
```

5. Defina o startup file como:

```txt
apps/api/dist/index.js
```

6. Configure as variaveis de ambiente.
7. Clique em **Run NPM Install**, **Enable Dependencies** ou equivalente, se o painel oferecer essa acao.
8. Inicie ou reinicie a aplicacao.

## Base URL da aplicacao Node

### Recomendado: backend em `/api`

Se o cPanel permitir escolher a base URL:

```txt
/api
```

O Express ja registra as rotas em `/api`, entao teste:

```txt
https://seudominio.com/api
```

Dependendo de como o Passenger repassa a base URL, pode acontecer de a rota final virar `/api/api`. Se isso acontecer, use uma destas correcoes:

- Coloque a aplicacao Node na base `/` de um subdominio `api.seudominio.com`.
- Ou altere o backend para registrar `routes` em `/` quando estiver em producao atras de uma base `/api`.

### Alternativa: backend em subdominio

Configure a aplicacao Node em:

```txt
https://api.seudominio.com/
```

Neste formato, o frontend atual precisara ser ajustado, porque hoje ele chama `/api/...` no mesmo dominio. Uma solucao simples e adicionar uma variavel `VITE_API_URL` no frontend e trocar as chamadas para usar essa base.

## Rodar migrations

Depois que o backend estiver com acesso ao banco, rode:

```sh
pnpm --filter @bo-law/api migration:run
pnpm --filter @bo-law/api bootstrap:root
```

Ou com npm:

```sh
npm --workspace @bo-law/api run migration:run
npm --workspace @bo-law/api run bootstrap:root
```

O bootstrap só cria o usuário quando ainda não existe nenhum root. Depois do primeiro
acesso, remova `BOOTSTRAP_ROOT_PASSWORD` das variáveis de ambiente.

## Testes depois do deploy

1. Abra:

```txt
https://seudominio.com/
```

2. Teste login com o usuario inicial.
3. Acesse diretamente uma rota interna, por exemplo:

```txt
https://seudominio.com/users
```

4. Teste a API:

```txt
https://seudominio.com/api
```

5. Verifique os logs da aplicacao Node. No Application Manager, os logs de Node costumam ficar na pasta `logs/` dentro do diretorio da aplicacao.

## Problemas comuns

### A tela abre, mas login/API falha

Verifique se `/api` esta chegando no backend. Se o backend estiver em subdominio, o frontend atual nao vai encontra-lo sem ajuste.

### Erro de `AUTH_SECRET`

Configure `AUTH_SECRET` nas variaveis de ambiente da aplicacao Node.

### Erro de conexao com PostgreSQL

Confira host, porta, usuario, senha e nome do banco. Em muitos cPanels, o nome real do banco e do usuario recebe prefixo da conta, como `usuario_nomebanco`.

### Erro ao acessar `/users` ou outra rota diretamente

O `.htaccess` do SPA fallback nao foi aplicado ou esta no diretorio errado.

### O cPanel nao mostra Node.js App

Nesse caso, nao da para hospedar este backend Express nesse cPanel compartilhado sem suporte adicional. As alternativas sao:

- Pedir ao provedor para habilitar Application Manager/Node.js.
- Hospedar apenas o frontend no cPanel e colocar o backend em Render, Railway, VPS ou outro provedor Node.js.
- Migrar o backend para PHP/Laravel, se a hospedagem for somente PHP.

## Checklist rapido

- [ ] cPanel tem Node.js 20 ou 22.
- [ ] PostgreSQL esta criado ou `DATABASE_URL` externo esta pronto.
- [ ] `AUTH_SECRET` foi configurado.
- [ ] `pnpm build` gerou `apps/web/dist/` e `apps/api/dist/`.
- [ ] Conteudo de `apps/web/dist/` foi enviado para `public_html/`.
- [ ] Backend foi registrado apontando para `apps/api/dist/index.js`.
- [ ] Migrations foram executadas.
- [ ] SSL esta ativo no dominio.
- [ ] Login foi testado em producao.
