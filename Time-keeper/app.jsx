/* App — wraps the three TODAY variations on a design canvas */

function App() {
  return (
    <DesignCanvas>
      <DCSection id="today" title="Today screen" subtitle="Three layout directions — pick one or mix-and-match">
        <DCArtboard id="a" label="A · Workshop ledger" width={375} height={812}>
          <VariationA/>
        </DCArtboard>
        <DCArtboard id="b" label="B · Focus stack" width={375} height={812}>
          <VariationB/>
        </DCArtboard>
        <DCArtboard id="c" label="C · Comb grid" width={375} height={812}>
          <VariationC/>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App/>);
