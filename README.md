# Controle de Estoque de Leite Materno

Projeto simples em terminal para registrar entradas/saídas de leite materno, manter saldo e gerar relatório local em CSV.

## Estrutura de arquivos

```
.
├── leite_estoque.py
├── leite_estoque.csv   # criado automaticamente
└── resumo_leite_estoque.csv  # criado ao exportar
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
