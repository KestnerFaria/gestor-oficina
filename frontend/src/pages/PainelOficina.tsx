import { useEffect, useState } from "react";
import type { Oficina, Ordem, Usuario } from "../api";
import type { AcoesDaOficina, DadosDaOficina } from "../hooks/useDadosOficina";
import { abasDoPerfil, type Aba } from "../regras";
import { btnBase, C, FONTS } from "../styles/theme";
import { Auditoria } from "./Auditoria";
import { ClientesVeiculos } from "./ClientesVeiculos";
import { DadosOficina } from "./DadosOficina";
import { Dashboard } from "./Dashboard";
import { Despesas } from "./Despesas";
import { Equipe } from "./Equipe";
import { Financeiro } from "./Financeiro";
import { MinhaAssinatura } from "./MinhaAssinatura";
import { DetalheOS } from "./ordens/DetalheOS";
import { ImpressaoOS } from "./ordens/ImpressaoOS";
import { NovaOS } from "./ordens/NovaOS";
import { ServicosEstoque } from "./ServicosEstoque";

interface PainelOficinaProps {
  usuario: Usuario;
  oficina: Oficina;
  dados: DadosDaOficina;
  actions: AcoesDaOficina;
  onSair: () => void;
}

export function PainelOficina({ usuario, oficina, dados, actions, onSair }: PainelOficinaProps) {
  const [aba, setAba] = useState<Aba>("dashboard");
  const [imprimindo, setImprimindo] = useState<Ordem | null>(null); // O.S. a imprimir
  const [gerenciando, setGerenciando] = useState<Ordem | null>(null); // O.S. aberta para gestão

  const { usuarios, clientes, veiculos, servicos, produtos, ordens, pagamentos, despesas, auditoria, alertas } = dados;
  const abas = abasDoPerfil(usuario.perfil);
  // proteção extra: mesmo que alguém force a aba, só mostra se o perfil tem acesso
  const pode = (id: Aba) => abas.some((a) => a.id === id);

  // despesas e auditoria são carregadas sob demanda, só quando a aba é aberta
  // (os endpoints são só de admin e não faz sentido pré-carregar pra todo mundo)
  useEffect(() => {
    if (aba === "despesas" && pode("despesas")) actions.carregarDespesas().catch(() => {});
    if (aba === "auditoria" && pode("auditoria")) actions.carregarAuditoria().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba]);

  if (gerenciando) {
    return (
      <DetalheOS
        usuario={usuario}
        actions={actions}
        os={gerenciando}
        cliente={clientes.find((c) => c.id === gerenciando.clienteId)}
        veiculo={veiculos.find((v) => v.id === gerenciando.veiculoId)}
        servicos={servicos}
        produtos={produtos}
        equipe={usuarios}
        ordens={ordens}
        onVoltar={() => setGerenciando(null)}
        onImprimir={(os) => {
          setGerenciando(null);
          setImprimindo(os);
        }}
      />
    );
  }

  return (
    <>
      <div
        style={{
          fontFamily: "Inter, sans-serif",
          background: C.bg,
          minHeight: 600,
          display: "grid",
          gridTemplateColumns: "210px 1fr",
          borderRadius: 12,
          overflow: "hidden",
          border: `1px solid ${C.border}`,
        }}
      >
        <style>{FONTS}</style>

        <div style={{ background: C.steel, padding: "20px 14px", color: "#fff", display: "flex", flexDirection: "column" }}>
          {oficina.logo && (
            <img src={oficina.logo} alt="logo" style={{ width: 36, height: 36, objectFit: "contain", borderRadius: 6, background: "#fff", marginBottom: 10, marginLeft: 4 }} />
          )}
          <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 15, fontWeight: 600, letterSpacing: 0.5, paddingLeft: 4, lineHeight: 1.3 }}>{oficina.nome?.toUpperCase()}</div>
          <div style={{ fontSize: 11, color: "#8F959D", paddingLeft: 4, marginBottom: 22, marginTop: 2 }}>{oficina.cnpj || ""}</div>

          {abas.map((n) => (
            <div
              key={n.id}
              onClick={() => setAba(n.id)}
              style={{
                padding: "10px",
                borderRadius: 5,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                marginBottom: 2,
                background: aba === n.id ? C.accent : "transparent",
                color: aba === n.id ? "#fff" : "#C7CBD1",
              }}
            >
              {n.label}
            </div>
          ))}

          <div style={{ marginTop: "auto", paddingTop: 20, borderTop: "1px solid #4A5058" }}>
            <div style={{ fontSize: 12, color: "#fff", fontWeight: 500 }}>{usuario.nome}</div>
            <div style={{ fontSize: 11, color: "#8F959D", marginBottom: 10 }}>{usuario.perfil}</div>
            <button
              style={{ ...btnBase, width: "100%", padding: "6px 0", fontSize: 12, background: "transparent", borderColor: "#4A5058", color: "#C7CBD1" }}
              onClick={onSair}
            >
              sair
            </button>
          </div>
        </div>

        <div style={{ padding: 24, overflowX: "auto" }}>
          {aba === "dashboard" && (
            <Dashboard
              clientes={clientes}
              veiculos={veiculos}
              ordens={ordens}
              pagamentos={pagamentos}
              servicos={servicos}
              oficina={oficina}
              alertas={alertas}
              actions={actions}
              onImprimir={setImprimindo}
              onAbrir={setGerenciando}
            />
          )}

          {aba === "nova_os" && (
            <NovaOS clientes={clientes} veiculos={veiculos} servicos={servicos} produtos={produtos} equipe={usuarios} actions={actions} onImprimir={setImprimindo} />
          )}

          {aba === "clientes" && <ClientesVeiculos meusClientes={clientes} veiculos={veiculos} actions={actions} />}

          {aba === "catalogo" && <ServicosEstoque meusServicos={servicos} meusProdutos={produtos} actions={actions} />}

          {aba === "financeiro" && pode("financeiro") && (
            <Financeiro usuarios={usuarios} meusPagamentos={pagamentos} ordens={ordens} clientes={clientes} actions={actions} />
          )}

          {aba === "despesas" && pode("despesas") && <Despesas despesas={despesas} meusPagamentos={pagamentos} actions={actions} />}

          {aba === "empresa" && <DadosOficina usuario={usuario} oficina={oficina} actions={actions} />}

          {aba === "assinatura" && pode("assinatura") && <MinhaAssinatura actions={actions} />}

          {aba === "equipe" && pode("equipe") && <Equipe usuario={usuario} minhaEquipe={usuarios} actions={actions} />}

          {aba === "auditoria" && pode("auditoria") && <Auditoria auditoria={auditoria} equipe={usuarios} />}
        </div>
      </div>

      {imprimindo && (
        <ImpressaoOS
          os={imprimindo}
          oficina={oficina}
          cliente={clientes.find((c) => c.id === imprimindo.clienteId)}
          veiculo={veiculos.find((v) => v.id === imprimindo.veiculoId)}
          usuarios={usuarios}
          servicos={servicos}
          produtos={produtos}
          pagamentos={pagamentos.filter((p) => p.osId === imprimindo.id)}
          onFechar={() => setImprimindo(null)}
        />
      )}
    </>
  );
}
