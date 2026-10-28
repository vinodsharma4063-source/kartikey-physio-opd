
import React from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

function App() {
  return (
    <main className="app">
      <header className="header">
        <div className="logo">K</div>
        <div>
          <h1>Kartikey Physiotherapy Clinic</h1>
          <p>Patient & OPD Management</p>
        </div>
      </header>

      <section className="welcome">
        <h2>नमस्ते, आपका स्वागत है!</h2>
        <p>क्लिनिक के मरीजों और रोज़ाना के सेशन का रिकॉर्ड यहाँ संभालें।</p>
      </section>

      <section className="cards">
        <article className="card">
          <span>मरीज</span>
          <h3>Patients</h3>
          <p>मरीजों का रिकॉर्ड</p>
        </article>
        <article className="card">
          <span>विज़िट</span>
          <h3>Visits</h3>
          <p>रोज़ाना के ट्रीटमेंट सेशन</p>
        </article>
        <article className="card">
          <span>पेमेंट</span>
          <h3>Payments</h3>
          <p>फीस और भुगतान</p>
        </article>
        <article className="card">
          <span>पैकेज</span>
          <h3>Packages</h3>
          <p>सेशन पैकेज का हिसाब</p>
        </article>
      </section>

      <footer>Physiotherapist Vinod Sharma</footer>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
