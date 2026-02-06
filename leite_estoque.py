#!/usr/bin/env python3
import csv
import os
from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional, Dict

DATA_FILE = "leite_estoque.csv"
EXPORT_FILE = "resumo_leite_estoque.csv"
DATE_FMT = "%Y-%m-%d"


@dataclass
class Movimento:
    tipo: str
    data: str
    volume_ml: int
    quantidade_sacos: int
    local: str
    data_ordenha: str
    validade: str
    observacao: str

    @property
    def total_ml(self) -> int:
        return self.volume_ml * self.quantidade_sacos


@dataclass
class EntradaRestante:
    movimento: Movimento
    restante_ml: int


FIELDS = [
    "tipo",
    "data",
    "volume_ml",
    "quantidade_sacos",
    "local",
    "data_ordenha",
    "validade",
    "observacao",
]


def ensure_data_file() -> None:
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, "w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=FIELDS)
            writer.writeheader()


def parse_int(value: str, default: Optional[int] = None) -> int:
    value = value.strip()
    if not value:
        if default is None:
            raise ValueError("Valor obrigatório.")
        return default
    return int(value)


def parse_date_optional(value: str) -> str:
    value = value.strip()
    if not value:
        return ""
    datetime.strptime(value, DATE_FMT)
    return value


def load_movimentos() -> List[Movimento]:
    ensure_data_file()
    movimentos: List[Movimento] = []
    with open(DATA_FILE, "r", newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            movimentos.append(
                Movimento(
                    tipo=row["tipo"],
                    data=row["data"],
                    volume_ml=int(row["volume_ml"]),
                    quantidade_sacos=int(row["quantidade_sacos"]),
                    local=row["local"],
                    data_ordenha=row["data_ordenha"],
                    validade=row["validade"],
                    observacao=row["observacao"],
                )
            )
    return movimentos


def save_movimento(movimento: Movimento) -> None:
    ensure_data_file()
    with open(DATA_FILE, "a", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writerow(
            {
                "tipo": movimento.tipo,
                "data": movimento.data,
                "volume_ml": movimento.volume_ml,
                "quantidade_sacos": movimento.quantidade_sacos,
                "local": movimento.local,
                "data_ordenha": movimento.data_ordenha,
                "validade": movimento.validade,
                "observacao": movimento.observacao,
            }
        )


def saldo_total(movimentos: List[Movimento]) -> int:
    entradas = sum(m.total_ml for m in movimentos if m.tipo == "entrada")
    saidas = sum(m.total_ml for m in movimentos if m.tipo == "saida")
    return entradas - saidas


def saldo_por_volume(movimentos: List[Movimento]) -> Dict[int, int]:
    saldo: Dict[int, int] = {}
    for movimento in movimentos:
        volume = movimento.volume_ml
        saldo.setdefault(volume, 0)
        if movimento.tipo == "entrada":
            saldo[volume] += movimento.total_ml
        else:
            saldo[volume] -= movimento.total_ml
    return saldo


def entradas_com_saldo(movimentos: List[Movimento]) -> List[EntradaRestante]:
    entradas = [m for m in movimentos if m.tipo == "entrada"]
    saidas = [m for m in movimentos if m.tipo == "saida"]
    entradas_sorted = sorted(
        entradas,
        key=lambda m: parse_date_optional(m.data_ordenha) or m.data,
    )
    restante_por_entrada = [EntradaRestante(m, m.total_ml) for m in entradas_sorted]
    total_saida = sum(m.total_ml for m in saidas)
    for entrada in restante_por_entrada:
        if total_saida <= 0:
            break
        consumo = min(entrada.restante_ml, total_saida)
        entrada.restante_ml -= consumo
        total_saida -= consumo
    return [e for e in restante_por_entrada if e.restante_ml > 0]


def sugestao_fifo(movimentos: List[Movimento]) -> List[EntradaRestante]:
    entradas_restantes = entradas_com_saldo(movimentos)
    def key_func(item: EntradaRestante):
        validade = item.movimento.validade
        data_base = item.movimento.data_ordenha or item.movimento.data
        return (
            parse_date_optional(validade) if validade else "9999-12-31",
            data_base,
        )
    return sorted(entradas_restantes, key=key_func)


def imprimir_relatorio(movimentos: List[Movimento]) -> None:
    total = saldo_total(movimentos)
    saldo_volume = saldo_por_volume(movimentos)
    print("\n=== RELATÓRIO ===")
    print(f"Saldo total: {total} ml")
    print("Saldo por volume (ml por tamanho de saco):")
    for volume, total_ml in sorted(saldo_volume.items()):
        print(f"  {volume} ml -> {total_ml} ml")

    print("\nSugestão FIFO / vencimento (usar primeiro):")
    sugestoes = sugestao_fifo(movimentos)[:5]
    if not sugestoes:
        print("  Nenhuma entrada com saldo disponível.")
    for item in sugestoes:
        m = item.movimento
        print(
            f"  Data: {m.data} | Volume: {m.volume_ml} ml | "
            f"Qtd sacos: {m.quantidade_sacos} | Restante: {item.restante_ml} ml | "
            f"Validade: {m.validade or 'n/a'}"
        )

    print("\nMovimentações recentes:")
    for movimento in movimentos[-5:]:
        print(
            f"  [{movimento.tipo}] {movimento.data} | {movimento.total_ml} ml | "
            f"Obs: {movimento.observacao or '-'}"
        )


def exportar_resumo(movimentos: List[Movimento]) -> None:
    total = saldo_total(movimentos)
    saldo_volume = saldo_por_volume(movimentos)
    with open(EXPORT_FILE, "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["tipo", "descricao", "valor"])
        writer.writerow(["saldo_total_ml", "Saldo total", total])
        for volume, total_ml in sorted(saldo_volume.items()):
            writer.writerow(["saldo_volume_ml", f"{volume} ml", total_ml])
        writer.writerow([])
        writer.writerow(
            [
                "tipo",
                "data",
                "total_ml",
                "observacao",
            ]
        )
        for movimento in movimentos[-10:]:
            writer.writerow(
                [
                    movimento.tipo,
                    movimento.data,
                    movimento.total_ml,
                    movimento.observacao,
                ]
            )
    print(f"Resumo exportado para {EXPORT_FILE}.")


def registrar_entrada() -> None:
    data = input(f"Data (AAAA-MM-DD) [hoje]: ").strip() or datetime.now().strftime(DATE_FMT)
    datetime.strptime(data, DATE_FMT)
    volume_ml = parse_int(input("Volume por saco (ml): "))
    quantidade_sacos = parse_int(input("Quantidade de sacos: "), default=1)
    local = input("Local (freezer/geladeira): ").strip() or "freezer"
    data_ordenha = parse_date_optional(input("Data ordenha (AAAA-MM-DD) [opcional]: "))
    validade = parse_date_optional(input("Validade (AAAA-MM-DD) [opcional]: "))
    observacao = input("Observação (opcional): ").strip()

    movimento = Movimento(
        tipo="entrada",
        data=data,
        volume_ml=volume_ml,
        quantidade_sacos=quantidade_sacos,
        local=local,
        data_ordenha=data_ordenha,
        validade=validade,
        observacao=observacao,
    )
    save_movimento(movimento)
    print("Entrada registrada com sucesso!")


def registrar_saida() -> None:
    movimentos = load_movimentos()
    total_disponivel = saldo_total(movimentos)
    if total_disponivel <= 0:
        print("Não há estoque disponível para saída.")
        return

    data = input(f"Data (AAAA-MM-DD) [hoje]: ").strip() or datetime.now().strftime(DATE_FMT)
    datetime.strptime(data, DATE_FMT)
    volume_ml = parse_int(input("Volume por saco (ml): "))
    quantidade_sacos = parse_int(input("Quantidade de sacos [1]: "), default=1)
    observacao = input("Motivo/observação: ").strip()

    movimento = Movimento(
        tipo="saida",
        data=data,
        volume_ml=volume_ml,
        quantidade_sacos=quantidade_sacos,
        local="",
        data_ordenha="",
        validade="",
        observacao=observacao,
    )

    if movimento.total_ml > total_disponivel:
        print(
            f"Saída inválida: {movimento.total_ml} ml excede o estoque disponível "
            f"({total_disponivel} ml)."
        )
        return

    save_movimento(movimento)
    print("Saída registrada com sucesso!")


def menu() -> None:
    ensure_data_file()
    while True:
        print(
            "\n=== CONTROLE DE ESTOQUE DE LEITE ===\n"
            "1) Registrar entrada\n"
            "2) Registrar saída\n"
            "3) Ver relatório\n"
            "4) Exportar resumo CSV\n"
            "0) Sair\n"
        )
        opcao = input("Escolha uma opção: ").strip()
        if opcao == "1":
            registrar_entrada()
        elif opcao == "2":
            registrar_saida()
        elif opcao == "3":
            movimentos = load_movimentos()
            imprimir_relatorio(movimentos)
        elif opcao == "4":
            movimentos = load_movimentos()
            exportar_resumo(movimentos)
        elif opcao == "0":
            print("Até logo!")
            break
        else:
            print("Opção inválida.")


if __name__ == "__main__":
    menu()
