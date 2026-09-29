import { useState } from "react";
import type { Despesa, Id, Pagamento } from "../api";
import { StatCard } from "../components/ui";
import { CATEGORIAS_DESPESA } from "../constants";
import { faturamentoDoMes } from "../regras";
import { btnBase, btnPrimary, C, inputStyle } from "../styles/theme";
import { fmtData, hojeISO } from "../utils/datas";
import { mensagemDeErro } from "../utils/erros";

interface NovaDespesa {
  descricao: string;
  categoria: string;
  valor: string; // texto enquanto o usuário digita; vira número ao salvar
  dataVencimento: string;
  fixa: boolean;
}

const FORM_VAZIO: NovaDespesa = { descricao: "", categoria: "outros", valor: "", dataVencimento: "", fixa: false };

interface DespesasProps {
  despesas: Despesa[];
  meusPagamentos: Pagamento[];
  actions: {
    criarDespesa: (dados: Omit<NovaDespesa, "valor"> & { valor: number }) => Promise<void>;
    excluirDespesa: (id: Id) => Promise<void>;
  };
}

export function Despesas({ despesas, meusPagamentos, actions }: DespesasProps) {
  const [showNovo, setShowNovo] = useState(false);
  const [form, setForm] = useState<NovaDespesa>(FORM_VAZIO);
  const [confirmarExclusao, setConfirmarExclusao] = useState<Id | null>(null);
  const [erro, setErro] = useState("");

  const totalMes = despesas.reduce((soma, d) => soma + d.valor, 0);
  const mesAtual = hojeISO().slice(0, 7);
  const faturamentoMes = faturamentoDoMes(meusPagamentos, mesAtual);
  const saldo = faturamentoMes - totalMes;

  async function addDespesa() {
    if (!form.descricao || !form.valor) return;
    try {
      await actions.criarDespesa({ ...form, valor: Number(form.valor) });
      setForm(FORM_VAZIO);
      setShowNovo(false);
      setErro("");
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  }

  async function removerDespesa(d: Despesa) {
    try {
      await actions.excluirDespesa(d.id);
      setConfirmarExclusao(null);
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  }

  return (
    <div style={{ maxWidth: 780 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 20, fontWeight: 600, color: C.ink }}>despesas mensais</div>
          <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 2 }}>total de despesas cadastradas: R$ {totalMes.toLocaleString("pt-BR")}</div>
        </div>
        <button style={btnPrimary} onClick={() => setShowNovo(!showNovo)}>
          + nova despesa
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 18 }}>
        <StatCard label="faturamento do mês" value={`R$ ${faturamentoMes.toLocaleString("pt-BR")}`} tone="ok" />
        <StatCard label="despesas do mês" value={`R$ ${totalMes.toLocaleString("pt-BR")}`} tone="danger" />
        <StatCard label="saldo do mês" value={`R$ ${saldo.toLocaleString("pt-BR")}`} tone={saldo >= 0 ? "ok" : "danger"} />
      </div>

      {showNovo && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            <input
              style={inputStyle}
              placeholder="descrição · Ex: aluguel do galpão"
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            />
            <select style={inputStyle} value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
              {Object.entries(CATEGORIAS_DESPESA).map(([categoria, label]) => (
                <option key={categoria} value={categoria}>
                  {label}
                </option>
              ))}
            </select>
            <input style={inputStyle} placeholder="valor (R$)" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12, alignItems: "center" }}>
            <input style={inputStyle} type="date" value={form.dataVencimento} onChange={(e) => setForm({ ...form, dataVencimento: e.target.value })} />
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.inkSoft }}>
              <input type="checkbox" checked={form.fixa} onChange={(e) => setForm({ ...form, fixa: e.target.checked })} />
              despesa fixa (se repete todo mês)
            </label>
          </div>
          {erro && <div style={{ fontSize: 12, color: C.danger, marginBottom: 12 }}>{erro}</div>}
          <button style={{ ...btnPrimary, width: "100%" }} onClick={addDespesa}>
            salvar despesa
          </button>
        </div>
      )}

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
        {despesas.length === 0 && <div style={{ padding: 24, textAlign: "center", fontSize: 13, color: C.muted }}>nenhuma despesa cadastrada ainda.</div>}
        {despesas.map((d, i) => (
          <div
            key={d.id}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderTop: i === 0 ? "none" : `1px solid ${C.border}` }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>{d.descricao}</div>
              <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>
                {CATEGORIAS_DESPESA[d.categoria]}
                {d.fixa ? " · fixa" : ""}
                {d.dataVencimento ? ` · vence ${fmtData(d.dataVencimento)}` : ""}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 600, fontFamily: "JetBrains Mono, monospace", color: C.danger }}>
                R$ {d.valor.toLocaleString("pt-BR")}
              </span>
              {confirmarExclusao === d.id ? (
                <>
                  <button
                    style={{ ...btnBase, padding: "5px 10px", fontSize: 12, color: "#fff", background: C.danger, borderColor: C.danger }}
                    onClick={() => removerDespesa(d)}
                  >
                    confirmar
                  </button>
                  <button style={{ ...btnBase, padding: "5px 10px", fontSize: 12 }} onClick={() => setConfirmarExclusao(null)}>
                    cancelar
                  </button>
                </>
              ) : (
                <button style={{ ...btnBase, padding: "5px 10px", fontSize: 12, color: C.danger }} onClick={() => setConfirmarExclusao(d.id)}>
                  excluir
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
