import type { AlertaWhatsapp, Cliente, Id, Oficina, Ordem, Pagamento, Servico, Veiculo } from "../api";
import { Badge, Plate, StatCard } from "../components/ui";
import { STATUS_LABEL, STATUS_TONE } from "../constants";
import { clientesSemTrocaDeOleo, historicoDeMotor, linkWhatsapp, MESES_SEM_TROCA_DE_OLEO, resumoDoDia } from "../regras";
import { btnBase, btnPrimary, C } from "../styles/theme";
import { fmtData, fmtDataHora, hojeISO } from "../utils/datas";

const caixa = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 18px" } as const;
const cabecalhoTabela = { color: C.muted, textAlign: "left" } as const;

interface DashboardProps {
  clientes: Cliente[];
  veiculos: Veiculo[];
  ordens: Ordem[];
  pagamentos: Pagamento[];
  servicos: Servico[];
  oficina: Oficina | null;
  alertas: AlertaWhatsapp[];
  actions: {
    registrarAlerta: (clienteId: Id, veiculoId: Id) => Promise<void>;
  };
  onImprimir: (ordem: Ordem) => void;
  onAbrir: (ordem: Ordem) => void;
}

export function Dashboard({ clientes, veiculos, ordens, pagamentos, servicos, oficina, alertas, actions, onImprimir, onAbrir }: DashboardProps) {
  const { abertas, emAndamento, faturamentoHoje, atrasados } = resumoDoDia(ordens, pagamentos, hojeISO());
  const paraContato = clientesSemTrocaDeOleo({ clientes, veiculos, ordens, servicos });
  const historicoMotor = historicoDeMotor({ clientes, veiculos, ordens, servicos });

  const clienteNome = (id: Id) => clientes.find((c) => c.id === id)?.nome || "-";
  const veiculoInfo = (id: Id) => {
    const v = veiculos.find((veiculo) => veiculo.id === id);
    return v ? `${v.modelo} ${v.ano}` : "-";
  };

  return (
    <div>
      <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 20, fontWeight: 600, marginBottom: 18, color: C.ink }}>visão geral</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        <StatCard label="O.S. em aberto" value={abertas} />
        <StatCard label="em andamento" value={emAndamento} />
        <StatCard label="pagamentos atrasados" value={atrasados} tone={atrasados > 0 ? "danger" : "ok"} />
        <StatCard label="faturamento hoje" value={`R$ ${faturamentoHoje.toLocaleString("pt-BR")}`} tone="ok" />
      </div>

      <div style={{ ...caixa, marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: C.ink }}>ordens de serviço recentes</div>
        {ordens.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>nenhuma O.S. cadastrada ainda.</div>}
        {ordens.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={cabecalhoTabela}>
                <th style={{ fontWeight: 500, padding: "4px 0" }}>O.S.</th>
                <th style={{ fontWeight: 500 }}>cliente</th>
                <th style={{ fontWeight: 500 }}>veículo</th>
                <th style={{ fontWeight: 500 }}>status</th>
                <th style={{ fontWeight: 500, textAlign: "right" }}>valor</th>
                <th style={{ fontWeight: 500, textAlign: "right" }}></th>
              </tr>
            </thead>
            <tbody>
              {ordens.map((o) => (
                <tr key={o.id} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={{ padding: "9px 0", fontFamily: "JetBrains Mono, monospace" }}>{o.numero}</td>
                  <td>{clienteNome(o.clienteId)}</td>
                  <td>{veiculoInfo(o.veiculoId)}</td>
                  <td>
                    <Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                  </td>
                  <td style={{ textAlign: "right" }}>R$ {o.valorTotal.toLocaleString("pt-BR")}</td>
                  <td style={{ textAlign: "right" }}>
                    <button style={{ ...btnBase, padding: "4px 10px", fontSize: 12, marginRight: 6 }} onClick={() => onAbrir(o)}>
                      gerenciar
                    </button>
                    <button style={{ ...btnBase, padding: "4px 10px", fontSize: 12 }} onClick={() => onImprimir(o)}>
                      imprimir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* clientes sem troca de óleo há 6+ meses — alerta de retorno via whatsapp */}
      <div style={{ ...caixa, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>clientes sem retorno (troca de óleo há {MESES_SEM_TROCA_DE_OLEO}+ meses)</div>
          {paraContato.length > 0 && <Badge tone="warn">{paraContato.length}</Badge>}
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
          identificado pelo nome do serviço conter "óleo" no catálogo — confira se seus serviços de troca de óleo estão nomeados assim.
        </div>
        {paraContato.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>nenhum cliente atrasado no momento.</div>}
        {paraContato.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={cabecalhoTabela}>
                <th style={{ fontWeight: 500, padding: "4px 0" }}>cliente</th>
                <th style={{ fontWeight: 500 }}>telefone</th>
                <th style={{ fontWeight: 500 }}>veículo</th>
                <th style={{ fontWeight: 500 }}>última troca de óleo</th>
                <th style={{ fontWeight: 500 }}>tempo</th>
                <th style={{ fontWeight: 500 }}>alerta enviado em</th>
                <th style={{ fontWeight: 500, textAlign: "right" }}></th>
              </tr>
            </thead>
            <tbody>
              {paraContato.map(({ cliente, veiculo, ultima, meses }, i) => {
                const mensagem = `Olá ${cliente.nome.split(" ")[0]}! Aqui é da ${oficina?.nome || "oficina"}. Faz um tempo que não fazemos a troca de óleo do seu ${veiculo.modelo} (placa ${veiculo.placa}) — quer agendar uma revisão?`;
                const ultimoAlerta = alertas
                  .filter((a) => a.clienteId === cliente.id && a.veiculoId === veiculo.id)
                  .sort((a, b) => new Date(b.enviadoEm).getTime() - new Date(a.enviadoEm).getTime())[0];
                return (
                  <tr key={`${cliente.id}-${veiculo.id}`} style={{ borderTop: i === 0 ? "none" : `1px solid ${C.border}` }}>
                    <td style={{ padding: "9px 0" }}>{cliente.nome}</td>
                    <td>{cliente.telefone}</td>
                    <td>
                      {veiculo.modelo} <Plate placa={veiculo.placa} />
                    </td>
                    <td>{ultima ? fmtData(ultima.criadoEm.slice(0, 10)) : "nunca registrada"}</td>
                    <td>
                      <Badge tone="danger">{meses === null ? "nunca" : `${meses} meses`}</Badge>
                    </td>
                    <td>
                      {ultimoAlerta ? (
                        <span style={{ color: C.inkSoft }}>{fmtDataHora(ultimoAlerta.enviadoEm)}</span>
                      ) : (
                        <span style={{ color: C.muted }}>nunca enviado</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <a
                        href={linkWhatsapp(cliente.telefone, mensagem)}
                        target="_blank"
                        rel="noopener noreferrer"
                        // registra o clique; se falhar, não impede abrir o WhatsApp
                        onClick={() => actions.registrarAlerta(cliente.id, veiculo.id).catch(() => {})}
                        style={{ ...btnPrimary, padding: "5px 10px", fontSize: 12, textDecoration: "none", display: "inline-block" }}
                      >
                        chamar no whatsapp
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* histórico de manutenção de motor completo */}
      <div style={caixa}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: C.ink }}>veículos com manutenção de motor completo</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>identificado pelo nome do serviço conter "motor" no catálogo.</div>
        {historicoMotor.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>nenhum registro ainda.</div>}
        {historicoMotor.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={cabecalhoTabela}>
                <th style={{ fontWeight: 500, padding: "4px 0" }}>veículo</th>
                <th style={{ fontWeight: 500 }}>cliente</th>
                <th style={{ fontWeight: 500 }}>km no serviço</th>
                <th style={{ fontWeight: 500 }}>data</th>
                <th style={{ fontWeight: 500 }}>status</th>
              </tr>
            </thead>
            <tbody>
              {historicoMotor.map(({ os, cliente, veiculo }, i) => (
                <tr key={os.id} style={{ borderTop: i === 0 ? "none" : `1px solid ${C.border}` }}>
                  <td style={{ padding: "9px 0" }}>
                    {veiculo?.modelo} {veiculo?.placa && <Plate placa={veiculo.placa} />}
                  </td>
                  <td>{cliente?.nome}</td>
                  <td style={{ fontFamily: "JetBrains Mono, monospace" }}>{os.km || "-"}</td>
                  <td>{fmtData((os.dataSaida || os.criadoEm).slice(0, 10))}</td>
                  <td>
                    <Badge tone={STATUS_TONE[os.status]}>{STATUS_LABEL[os.status]}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
