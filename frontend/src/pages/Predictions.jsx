import AiPredictForm from '../components/AiPredictForm.jsx';
import OnchainPrediction from '../components/OnchainPrediction.jsx';

export default function Predictions() {
  return (
    <>
      <div className="page-head">
        <span className="eyebrow">// AI Predictions</span>
        <h1 className="title">Generate, hash, anchor</h1>
        <p className="subtitle">
          Generate a structured prediction with the Football OS AI engine, then publish it as a
          verifiable proof on X Layer. Every onchain submission is a real tx — no mock data.
        </p>
      </div>

      <AiPredictForm />

      <OnchainPrediction />
    </>
  );
}
