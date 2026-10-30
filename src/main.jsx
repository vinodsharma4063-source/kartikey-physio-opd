
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { supabase } from "./supabase.js";
import "./style.css";

function App() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    age: "",
    gender: "",
    address: "",
    diagnosis: "",
    medical_history: ""
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setLoginError(error.message);
      setSession(data?.session || null);
      setChecking(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) loadPatients();
  }, [session]);

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError("");

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });

    if (error) {
      setLoginError("Login नहीं हुआ: " + error.message);
    }
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) setMessage("Logout नहीं हुआ: " + error.message);
  }

  async function loadPatients() {
    setLoading(true);

    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      setMessage("मरीजों की सूची नहीं खुली: " + error.message);
    } else {
      setPatients(data || []);
      setMessage("");
    }

    setLoading(false);
  }

  function updateField(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function generatePatientCode() {
    const { data, error } = await supabase
      .from("patients")
      .select("patient_code");

    if (error) throw error;

    let highest = 0;

    (data || []).forEach((patient) => {
      const match = String(patient.patient_code || "").match(/^K(\d+)$/i);
      if (match) highest = Math.max(highest, Number(match[1]));
    });

    return "K" + String(highest + 1).padStart(3, "0");
  }

  async function addPatient(e) {
    e.preventDefault();
    setMessage("");
    setSaving(true);

    try {
      const patientCode = await generatePatientCode();

      const { error } = await supabase.from("patients").insert([{
        ...form,
        patient_code: patientCode,
        age: form.age ? Number(form.age) : null
      }]);

      if (error) throw error;

      setMessage("मरीज सफलतापूर्वक सेव हो गया। मरीज कोड: " + patientCode);

      setForm({
        full_name: "",
        phone: "",
        age: "",
        gender: "",
        address: "",
        diagnosis: "",
        medical_history: ""
      });

      await loadPatients();
    } catch (error) {
      setMessage("मरीज सेव नहीं हुआ: " + error.message);
    }

    setSaving(false);
  }

  const filtered = patients.filter((p) =>
    [p.full_name, p.patient_code, p.phone].some((v) =>
      String(v || "").toLowerCase().includes(search.toLowerCase())
    )
  );

  if (checking) {
    return <main className="app"><section className="card">लोड हो रहा है...</section></main>;
  }

  if (!session) {
    return (
      <main className="app">
        <header className="header">
          <div className="logo">K</div>
          <div>
            <h1>Kartikey Physiotherapy Clinic</h1>
            <p>OPD Management System</p>
          </div>
        </header>

        <section className="card">
          <h2>Owner Login</h2>
          <p>अपने Email और Password से Login करें।</p>

          <form className="patient-form" onSubmit={handleLogin}>
            <label>Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>

            <label>Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>

            <button type="submit">Login करें</button>
          </form>

          {loginError && <p role="alert">{loginError}</p>}
        </section>

        <footer>Physiotherapist Vinod Sharma</footer>
      </main>
    );
  }

  return (
    <main className="app">
      <header className="header">
        <div className="logo">K</div>
        <div>
          <h1>Kartikey Physiotherapy Clinic</h1>
          <p>OPD Management System</p>
        </div>
      </header>

      <section className="welcome">
        <h2>मरीज प्रबंधन</h2>
        <p>नया मरीज जोड़ें और पुराने मरीजों का रिकॉर्ड खोजें।</p>
        <p>Login: {session.user.email}</p>
        <button type="button" onClick={handleLogout}>Logout</button>
      </section>

      <section className="card">
        <h2>नया मरीज जोड़ें</h2>

        <form onSubmit={addPatient} className="patient-form">
          <label>मरीज का नाम *
            <input name="full_name" value={form.full_name} onChange={updateField} required />
          </label>

          <label>मरीज कोड
            <input value="सेव करते समय अपने आप बनेगा" readOnly />
          </label>

          <label>मोबाइल नंबर
            <input name="phone" value={form.phone} onChange={updateField} />
          </label>

          <label>उम्र
            <input name="age" type="number" min="0" value={form.age} onChange={updateField} />
          </label>

          <label>लिंग
            <select name="gender" value={form.gender} onChange={updateField}>
              <option value="">चुनें</option>
              <option value="Male">पुरुष</option>
              <option value="Female">महिला</option>
              <option value="Other">अन्य</option>
            </select>
          </label>

          <label>पता
            <input name="address" value={form.address} onChange={updateField} />
          </label>

          <label>बीमारी / Diagnosis
            <input name="diagnosis" value={form.diagnosis} onChange={updateField} />
          </label>

          <label>मेडिकल हिस्ट्री
            <textarea name="medical_history" value={form.medical_history} onChange={updateField} />
          </label>

          <button type="submit" disabled={saving}>
            {saving ? "सेव हो रहा है..." : "मरीज सेव करें"}
          </button>
        </form>

        {message && <p role="status">{message}</p>}
      </section>

      <section className="card patient-list">
        <h2>मरीजों की सूची ({filtered.length})</h2>

        <input
          placeholder="नाम, कोड या मोबाइल से खोजें"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {loading ? <p>लोड हो रहा है...</p> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>कोड</th>
                  <th>नाम</th>
                  <th>मोबाइल</th>
                  <th>उम्र</th>
                  <th>बीमारी</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td>{p.patient_code || "—"}</td>
                    <td>{p.full_name}</td>
                    <td>{p.phone || "—"}</td>
                    <td>{p.age ?? "—"}</td>
                    <td>{p.diagnosis || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && filtered.length === 0 && <p>अभी कोई मरीज नहीं मिला।</p>}
          </div>
        )}

        <button type="button" onClick={loadPatients}>सूची रीफ्रेश करें</button>
      </section>

      <footer>Physiotherapist Vinod Sharma</footer>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
