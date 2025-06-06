import React, { useEffect, useState } from 'react';
import axios from 'axios';

function App() {
  const [matrixStatus, setMatrixStatus] = useState(null);
  const [walletInfo, setWalletInfo] = useState(null);
  const [miningLogs, setMiningLogs] = useState([]);
  const [triads, setTriads] = useState([]);

  useEffect(() => {
    const baseURL = 'http://localhost:5000'; // Backend API base URL

    const fetchMatrixStatus = async () => {
      try {
        const res = await axios.get(\`\${baseURL}/status\`);
        setMatrixStatus(res.data);
      } catch (error) {
        console.error('Error fetching matrix status:', error);
      }
    };

    const fetchWalletInfo = async () => {
      try {
        const res = await axios.get(\`\${baseURL}/wallet\`);
        setWalletInfo(res.data);
      } catch (error) {
        console.error('Error fetching wallet info:', error);
      }
    };

    const fetchMiningLogs = async () => {
      try {
        const res = await axios.get(\`\${baseURL}/mining-activity\`);
        setMiningLogs(res.data);
      } catch (error) {
        console.error('Error fetching mining logs:', error);
      }
    };

    const fetchRecentTriads = async () => {
      try {
        const res = await axios.get(\`\${baseURL}/status\`);
        if (res.data && res.data.triads) {
          setTriads(res.data.triads.slice(-10).reverse());
        }
      } catch (error) {
        console.error('Error fetching recent triads:', error);
      }
    };

    fetchMatrixStatus();
    fetchWalletInfo();
    fetchMiningLogs();
    fetchRecentTriads();

    const interval = setInterval(() => {
      fetchMatrixStatus();
      fetchWalletInfo();
      fetchMiningLogs();
      fetchRecentTriads();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-8">
        <h1 className="text-4xl font-semibold mb-2">SeirChain Web Dashboard</h1>
        <p className="text-gray-400">Real-time overview of SeirChain status</p>
      </header>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Matrix Status</h2>
        {matrixStatus ? (
          <div className="grid grid-cols-2 gap-4 text-white">
            <div><strong>Dimensions:</strong> {matrixStatus.dimensions}x{matrixStatus.dimensions}x{matrixStatus.dimensions}</div>
            <div><strong>Complexity:</strong> {matrixStatus.complexity}</div>
            <div><strong>Consensus Threshold:</strong> {(matrixStatus.consensusThreshold * 100).toFixed(2)}%</div>
            <div><strong>Total Triads:</strong> {matrixStatus.triadsCount}</div>
            <div><strong>Validated Triads:</strong> {matrixStatus.triads ? matrixStatus.triads.filter(t => t.validated).length : 0}</div>
            <div><strong>Validators:</strong> {matrixStatus.validators ? matrixStatus.validators.length : 0}</div>
          </div>
        ) : (
          <p>Loading matrix status...</p>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Wallet Information</h2>
        {walletInfo ? (
          <div className="text-white">
            <p><strong>Address:</strong> {walletInfo.address}</p>
            <p><strong>Public Key:</strong> {walletInfo.publicKey}</p>
            <p><strong>Is Validator:</strong> {walletInfo.isValidator ? 'Yes' : 'No'}</p>
          </div>
        ) : (
          <p>Loading wallet information...</p>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Mining Activity Logs</h2>
        <div className="bg-gray-900 p-4 rounded max-h-48 overflow-y-auto text-white font-mono">
          {miningLogs.length > 0 ? (
            miningLogs.map((log, index) => (
              <div key={index}>
                <span className="text-gray-500">{new Date(log.timestamp).toLocaleTimeString()}:</span> {log.message}
              </div>
            ))
          ) : (
            <p>No mining activity logs available.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">Recent Triads</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-700 text-white">
            <thead className="bg-gray-800">
              <tr>
                <th className="px-4 py-2 border border-gray-700">ID</th>
                <th className="px-4 py-2 border border-gray-700">Data</th>
                <th className="px-4 py-2 border border-gray-700">Validator</th>
                <th className="px-4 py-2 border border-gray-700">Consensus</th>
                <th className="px-4 py-2 border border-gray-700">Status</th>
              </tr>
            </thead>
            <tbody>
              {triads.length > 0 ? (
                triads.map((triad) => (
                  <tr key={triad.id} className="hover:bg-gray-700">
                    <td className="px-4 py-2 border border-gray-700">{triad.id.substring(0, 8)}</td>
                    <td className="px-4 py-2 border border-gray-700">{JSON.stringify(triad.data).substring(0, 35)}</td>
                    <td className="px-4 py-2 border border-gray-700">{triad.validator.substring(0, 8)}</td>
                    <td className="px-4 py-2 border border-gray-700">{(triad.consensus * 100).toFixed(2)}%</td>
                    <td className="px-4 py-2 border border-gray-700">{triad.validated ? 'Validated' : 'Pending'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="text-center py-4">No triads available.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default App;
