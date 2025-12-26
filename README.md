# Total New - Flask File Processor

kiteforlife

## Descrição

Aplicação web Flask para processamento de arquivos Excel e CSV. Permite upload, visualização e processamento de dados de planilhas.

## Características

- 📁 Upload de arquivos Excel (.xlsx, .xls) e CSV
- 👁️ Visualização prévia dos dados
- 📊 Informações sobre linhas, colunas e estrutura dos dados
- 🎨 Interface moderna e responsiva
- 🚀 Processamento de dados com pandas

## Requisitos

- Python 3.8 ou superior
- pip (gerenciador de pacotes Python)

## Instalação

1. Clone o repositório:
```bash
git clone https://github.com/pepellon-cmyk/total-new.git
cd total-new
```

2. Crie um ambiente virtual (recomendado):
```bash
python -m venv venv
```

3. Ative o ambiente virtual:

**Windows:**
```bash
venv\Scripts\activate
```

**Linux/Mac:**
```bash
source venv/bin/activate
```

4. Instale as dependências:
```bash
pip install -r requirements.txt
```

## Uso

1. Inicie o servidor Flask:
```bash
python app.py
```

2. Abra o navegador e acesse:
```
http://localhost:5000
```

3. Faça upload de um arquivo Excel ou CSV através da interface

4. Visualize os dados e processe conforme necessário

## Estrutura do Projeto

```
total-new/
├── app.py                 # Servidor Flask principal
├── requirements.txt       # Dependências Python
├── README.md             # Este arquivo
├── .gitignore            # Arquivos ignorados pelo Git
├── templates/
│   └── index.html        # Template HTML principal
├── static/
│   ├── css/
│   │   └── styles.css    # Estilos CSS
│   └── js/
│       └── app.js        # JavaScript do frontend
└── uploads/              # Pasta para arquivos (criada automaticamente)
```

## Dependências

- **Flask 3.0.0**: Framework web
- **pandas 2.1.4**: Manipulação e análise de dados
- **openpyxl 3.1.2**: Leitura/escrita de arquivos Excel

## API Endpoints

### GET /
Página principal da aplicação

### POST /api/upload
Upload e processamento inicial de arquivo
- Aceita: multipart/form-data
- Retorna: informações do arquivo e prévia dos dados

### POST /api/process
Processamento de dados
- Aceita: application/json
- Retorna: resultado do processamento

## Desenvolvimento

Para contribuir com o projeto:

1. Faça um fork do repositório
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -am 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Crie um Pull Request

## Licença

Este projeto está sob licença MIT.

## Autor

kiteforlife

## Suporte

Para questões e suporte, abra uma issue no GitHub.
