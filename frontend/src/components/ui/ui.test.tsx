import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Badge, CamposComprovante, Field, Plate, SeletorForma, StatCard } from ".";
import { C } from "../../styles/theme";

// renderToStaticMarkup transforma o componente em HTML (texto), sem
// precisar de navegador. Serve para conferir o que ele mostra na tela.
const html = (elemento: React.ReactElement) => renderToStaticMarkup(elemento);

describe("Badge", () => {
  it("mostra o texto com a cor do tom escolhido", () => {
    const resultado = html(<Badge tone="danger">atrasado</Badge>);
    expect(resultado).toContain("atrasado");
    expect(resultado).toContain(C.danger);
  });

  it("usa o tom neutro quando nenhum é informado", () => {
    expect(html(<Badge>orçamento</Badge>)).toContain(C.inkSoft);
  });
});

describe("Plate", () => {
  it("mostra a placa", () => {
    expect(html(<Plate placa="ABC1D23" />)).toContain("ABC1D23");
  });
});

describe("Field", () => {
  it("mostra o rótulo e o campo", () => {
    const resultado = html(
      <Field label="telefone">
        <input name="telefone" />
      </Field>
    );
    expect(resultado).toContain("telefone");
    expect(resultado).toContain('<input name="telefone"/>');
  });
});

describe("StatCard", () => {
  it("fica vermelho no tom danger", () => {
    const resultado = html(<StatCard label="atrasados" value={3} tone="danger" />);
    expect(resultado).toContain("atrasados");
    expect(resultado).toContain(">3<");
    expect(resultado).toContain(C.dangerBg);
  });
});

describe("SeletorForma", () => {
  it("mostra as três formas de pagamento", () => {
    const resultado = html(<SeletorForma valor="pix" onChange={() => {}} />);
    expect(resultado).toContain("dinheiro");
    expect(resultado).toContain("cartão");
    expect(resultado).toContain("PIX");
  });

  it("destaca a forma selecionada", () => {
    const resultado = html(<SeletorForma valor="pix" onChange={() => {}} />);
    const botoes = resultado.split("<button").slice(1);
    const pix = botoes.find((b) => b.includes(">PIX<")) ?? "";
    const dinheiro = botoes.find((b) => b.includes(">dinheiro<")) ?? "";

    // o botão selecionado tem fundo laranja e texto em negrito; os outros não
    expect(pix).toContain(`background:${C.accent}`);
    expect(pix).toContain("font-weight:600");
    expect(dinheiro).not.toContain(`background:${C.accent}`);
  });
});

describe("CamposComprovante", () => {
  it("pede o ID da transação no PIX", () => {
    const resultado = html(
      <CamposComprovante forma="pix" documento="" comprovante={null} onDocumento={() => {}} onArquivo={() => {}} />
    );
    expect(resultado).toContain("ID da transação");
  });

  it("mostra o nome do comprovante anexado", () => {
    const resultado = html(
      <CamposComprovante
        forma="cartao"
        documento="004512"
        comprovante={{ nome: "recibo.pdf", tipo: "application/pdf", dados: "data:application/pdf;base64,AAA" }}
        onDocumento={() => {}}
        onArquivo={() => {}}
      />
    );
    expect(resultado).toContain("anexado: recibo.pdf");
    expect(resultado).toContain("número da nota / NSU");
  });
});
