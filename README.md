# Controle de Estoque de Leite Materno

Projeto simples em terminal para registrar entradas/saídas de leite materno, manter saldo e gerar relatório local em CSV.

## Estrutura de arquivos

```
.
├── leite_estoque.py
├── leite_estoque.csv   # criado automaticamente
├── resumo_leite_estoque.csv  # criado ao exportar
└── web/
    ├── index.html
    ├── style.css
    ├── app.js
    ├── manifest.webmanifest
    ├── sw.js
    └── icons/
        ├── icon-192.png
        └── icon-512.png
```

## Requisitos

- Python 3.8+

## Como rodar (passo a passo, bem iniciante)

1) Abra o terminal nesta pasta.
2) Rode o aplicativo:

```bash
python3 leite_estoque.py
```

3) Use o menu para registrar entradas, saídas, ver relatório e exportar resumo.

> O arquivo `leite_estoque.csv` será criado automaticamente na primeira execução.

## PWA offline (versão web)

A versão web fica na pasta `/web` e funciona offline após o primeiro acesso.

### Rodar localmente (PWA)

1) No terminal, vá para a pasta `web`:

```bash
cd web
```

2) Suba um servidor local simples:

```bash
python -m http.server 8000
```

3) Abra no navegador:

```
http://localhost:8000
```

### Publicar no GitHub Pages

1) No GitHub, vá em **Settings > Pages**.
2) Em **Build and deployment**, selecione:
   - Source: **Deploy from a branch**
   - Branch: **main**
   - Folder: **/web**
3) Salve. Após alguns minutos, a PWA estará disponível no link gerado.

### Instalar no iPhone (Safari)

1) Abra o link da PWA no Safari.
2) Toque em **Compartilhar**.
3) Selecione **Adicionar à Tela de Início**.
4) A partir daí, a PWA funciona como app e pode abrir offline.

## Exemplos de uso

### Registrar entrada

No menu, escolha **1) Registrar entrada** e preencha:

```
Data (AAAA-MM-DD) [hoje]: 2024-05-05
Volume por saco (ml): 100
Quantidade de sacos: 3
Local (freezer/geladeira): freezer
Data ordenha (AAAA-MM-DD) [opcional]: 2024-05-04
Validade (AAAA-MM-DD) [opcional]: 2024-08-04
Observação (opcional): leite noturno
```

### Registrar saída

No menu, escolha **2) Registrar saída**:

```
Data (AAAA-MM-DD) [hoje]: 2024-05-06
Volume por saco (ml): 100
Quantidade de sacos [1]: 1
Motivo/observação: consumo bebê
```

### Ver relatório

No menu, escolha **3) Ver relatório** para ver:
- saldo total em ml
- saldo por volume de saco
- sugestão FIFO/vencimento
- últimas movimentações

### Exportar resumo CSV

No menu, escolha **4) Exportar resumo CSV**.
O arquivo `resumo_leite_estoque.csv` será criado com o saldo e últimas movimentações.

## Regras e validações

- O sistema impede saída maior que o estoque total disponível.
- Os cálculos usam `volume_ml * quantidade_sacos`.
- FIFO considera a data de ordenha (se informada) e sugere os itens com validade mais próxima.
