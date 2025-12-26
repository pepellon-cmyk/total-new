# Kite for Life — Deploy

1. Instalar dependências:
   npm install

2. Rodar local:
   npm run dev

3. Criar repositório GitHub e push:
   git remote add origin <URL_DO_REPO>
   git push -u origin main

4. Configurar GitHub Actions:
   - Adicionar secrets do Heroku (HEROKU_API_KEY, HEROKU_APP_NAME, HEROKU_EMAIL)
   - Fazer push para main -> Actions irá rodar e tentar deployar