payment_method: "Cash",
        payment_date: new Date().toLocaleDateString("en-CA"),
        notes: ""
      });

      setMessage("Payment सफलतापूर्वक सेव हो गई।");
      await openHistory(selectedPatient);
    } catch (err) {
      setError("Payment सेव नहीं हुई: " + err.message);
    }
    setLoading(false);
  }

  const totalFee = visits.reduce((sum, v) => sum + (Number(v.fee) || 0), 0);
  const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const balance = totalFee - totalPaid;

  const filtered = patients.filter(p => {
    const q = search.toLowerCase();
    return String(p.full_name || "").toLowerCase().includes(q) ||
      String(p.patient_code || "").toLowerCase().includes(q) ||
      String(p.phone || "").includes(q);
  });

  if (checking) return <div className="app">Loading...</div>;

  if (!session) {
    return (
      <div className="app">
        <header className="header">
          <div className="logo">K</div>
          <div>
            <h1>Kartikey Physiotherapy Clinic</h1>
            <p>Lalkuan — OPD Management System</p>
          </div>
        </header>
        <section className="card">
          <h2>Owner Login</h2>
          <form className="patient-form" onSubmit={login}>
            <label>Email</label>
            <input type="email" value={email}
              onChange={e => setEmail(e.target.value)} required />
            <label>Password</label>
            <input type="password" value={password}
              onChange={e => setPassword(e.target.value)} required />
            {loginError && <p style={{color:"red"}}>{loginError}</p>}
            <button disabled={loading}>{loading ? "Logging in..." : "Login"}</button>
          </form>
        </section>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <div className="logo">K</div>
        <div>
          <h1>Kartikey Physiotherapy Clinic</h1>
          <p>Lalkuan — OPD Management System</p>
          <p>Physiotherapist Vinod Sharma | 9761230211</p>
        </div>
        <button onClick={logout}>Logout</button>
      </header>

      {error && <div className="card" style={{color:"red"}}>{error}</div>}
      {message && <div className="card" style={{color:"green"}}>{message}</div>}

      {!selectedPatient && (
        <>
          <section className="card">
            <h2>Add New Patient</h2>
            <form className="patient-form" onSubmit={addPatient}>
              <label>Patient Name *</label>
              <input value={form.full_name}
                onChange={e => setForm({...form, full_name:e.target.value})} required />
              <label>Mobile Number</label>
              <input value={form.phone}
                onChange={e => setForm({...form, phone:e.target.value})} />
              <label>Age</label>
              <input type="number" value={form.age}
                onChange={e => setForm({...form, age:e.target.value})} />
              <label>Gender</label>
              <select value={form.gender}
                onChange={e => setForm({...form, gender:e.target.value})}>
                <option value="">Select Gender</option>
                <option>Male</option><option>Female</option><option>Other</option>
              </select>
              <label>Address</label>
              <input value={form.address}
                onChange={e => setForm({...form, address:e.target.value})} />
              <label>Diagnosis / Problem</label>
              <input value={form.diagnosis}
                onChange={e => setForm({...form, diagnosis:e.target.value})} />
              <label>Medical History</label>
              <textarea value={form.medical_history}
                onChange={e => setForm({...form, medical_history:e.target.value})} />
              <button disabled={loading}>Save Patient</button>
            </form>
          </section>

          <section className="card patient-list">
            <h2>Patient List</h2>
            <p>Total Patients: {patients.length}</p>
            <input placeholder="Search name, code or phone"
              value={search} onChange={e => setSearch(e.target.value)} />
            <div className="table-wrap">
              <table className="table">
                <thead><tr>
                  <th>Patient Code</th><th>Patient Name</th>
                  <th>Mobile</th><th>Diagnosis</th><th>History</th>
                </tr></thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.id}>
                      <td>{p.patient_code}</td>
                      <td>
                        <button type="button" onClick={() => openHistory(p)}
                          style={{background:"none",color:"#075fbd",padding:0}}>
                          {p.full_name}
                        </button>
                      </td>
                      <td>{p.phone || "—"}</td>
                      <td>{p.diagnosis || "—"}</td>
                      <td><button onClick={() => openHistory(p)}>Open History</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {selectedPatient && (
        <section className="card">
          <button onClick={() => {
            setSelectedPatient(null);
            setError("");
            setMessage("");
          }}>← Back to Patient List</button>

          <h2>Patient History</h2>
          <p><strong>Patient Code:</strong> {selectedPatient.patient_code}</p>
          <p><strong>Name:</strong> {selectedPatient.full_name}</p>
          <p><strong>Mobile:</strong> {selectedPatient.phone || "—"}</p>
          <p><strong>Age:</strong> {selectedPatient.age ?? "—"}</p>
          <p><strong>Gender:</strong> {selectedPatient.gender || "—"}</p>
          <p><strong>Diagnosis:</strong> {selectedPatient.diagnosis || "—"}</p>
          <p><strong>Medical History:</strong> {selectedPatient.medical_history || "—"}</p>

          <hr />
          <h2>Add Daily Session</h2>
          <p>Next Session Number: <strong>{Math.max(0,...visits.map(v => Number(v.session_number)||0))+1}</strong></p>
          <form className="patient-form" onSubmit={addVisit}>
            <label>Session Date *</label>
            <input type="date" value={visitForm.visit_date}
              onChange={e => setVisitForm({...visitForm,visit_date:e.target.value})} required />
            <label>Attendance Status *</label>
            <select
              value={visitForm.attendance_status}
              onChange={e => setVisitForm({...visitForm, attendance_status:e.target.value})}
            >
              <option value="Present">Present</option>
              <option value="Absent">Absent</option>
              <option value="Holiday">Holiday</option>
            </select>
            <label>Treatment {visitForm.attendance_status === "Present" ? "*" : "(Optional)"}</label>
            <input value={visitForm.treatment}
              onChange={e => setVisitForm({...visitForm,treatment:e.target.value})}
              placeholder="IFT, Ultrasound, Exercise"
              required={visitForm.attendance_status === "Present"} />
            <label>Notes</label>
            <textarea value={visitForm.notes}
              onChange={e => setVisitForm({...visitForm,notes:e.target.value})} />
            <label>Session Fee (₹) {visitForm.attendance_status !== "Present" ? "(Present के लिए ही)" : ""}</label>
            <input type="number" min="0" step="0.01" value={visitForm.fee}
              disabled={visitForm.attendance_status !== "Present"}
              onChange={e => setVisitForm({...visitForm,fee:e.target.value})} />
            <button disabled={loading}>Save Daily Session</button>
          </form>

          <h2>Previous Sessions</h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Session</th><th>Date</th><th>Attendance</th><th>Treatment</th><th>Notes</th><th>Fee</th></tr></thead>
              <tbody>
                {visits.map(v => (
                  <tr key={v.id}>
                    <td>{v.session_number ?? "—"}</td><td>{v.visit_date}</td>
                    <td>{v.attendance_status || "Present"}</td>
                    <td>{v.treatment || "—"}</td><td>{v.notes || "—"}</td>
