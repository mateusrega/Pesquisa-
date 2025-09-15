import React, { useState, useEffect } from "react";
import { auth, db, loginWithGoogle, adminUID } from "./firebase";
import { collection, doc, setDoc, getDoc, addDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { Chart, registerables } from "chart.js";

Chart.register(...registerables);

const formsByArea = {
  estudante: [
    { type: "text", label: "Qual curso você faz?" },
    { type: "radio", label: "Você utiliza ferramentas online?", options:["Sim","Não"] }
  ],
  pessoal: [
    { type: "text", label: "O que você busca melhorar pessoalmente?" },
    { type: "checkbox", label: "Quais hábitos você segue?", options:["Leitura","Exercícios","Meditação"] }
  ],
  criador: [
    { type: "text", label: "Qual tipo de conteúdo você produz?" },
    { type: "radio", label: "Você monetiza seu conteúdo?", options:["Sim","Não"] }
  ],
  comercial: [
    { type: "text", label: "Qual o tamanho da sua empresa?" },
    { type: "checkbox", label: "Quais áreas deseja otimizar?", options:["Marketing","Vendas","TI"] }
  ],
  pequenaEmpresa: [
    { type: "text", label: "Qual segmento da empresa?" },
    { type: "radio", label: "Você utiliza automações?", options:["Sim","Não"] }
  ],
  freelancer: [
    { type: "text", label: "Qual sua principal habilidade?" },
    { type: "radio", label: "Você trabalha sozinho ou em equipe?", options:["Sozinho","Equipe"] }
  ]
};

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [userArea, setUserArea] = useState("");
  const [screen, setScreen] = useState("login"); // login, area, form, admin
  const [responses, setResponses] = useState([]);

  useEffect(() => {
    if(screen==="admin"){
      const unsub = onSnapshot(collection(db, "responses"), snapshot=>{
        const data = snapshot.docs.map(d=>d.data());
        setResponses(data);
        renderChart(data);
      });
      return ()=>unsub();
    }
  }, [screen]);

  const handleLogin = async () => {
    try{
      const user = await loginWithGoogle();
      setCurrentUser(user);
      if(user.uid === adminUID){
        setScreen("admin");
        return;
      }
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if(userDoc.exists() && userDoc.data().area){
        setUserArea(userDoc.data().area);
        setScreen("form");
      } else {
        setScreen("area");
      }
    }catch(e){
      alert("Erro: "+e.message);
    }
  };

  const saveArea = async () => {
    if(!userArea){ alert("Selecione uma área"); return; }
    await setDoc(doc(db, "users", currentUser.uid), { email: currentUser.email, area: userArea });
    setScreen("form");
  };

  const submitForm = async () => {
    const answers = {};
    const questions = formsByArea[userArea];
    questions.forEach((q,i)=>{
      if(q.type==="text" || q.type==="textarea"){
        answers[q.label] = document.getElementById(`q${i}`).value;
      }else if(q.type==="radio"){
        const checked = document.querySelector(`input[name="q${i}"]:checked`);
        answers[q.label] = checked? checked.value : "";
      }else if(q.type==="checkbox"){
        answers[q.label] = Array.from(document.querySelectorAll(`input[name="q${i}"]:checked`)).map(c=>c.value);
      }
    });
    await addDoc(collection(db, "responses"), {
      userId: currentUser.uid,
      email: currentUser.email,
      area: userArea,
      answers,
      timestamp: serverTimestamp()
    });
    alert("Resposta enviada!");
  };

  const renderChart = (data) => {
    const areas = {};
    data.forEach(d=> areas[d.area]=(areas[d.area]||0)+1);
    const ctx = document.getElementById("chart").getContext("2d");
    const labels = Object.keys(areas);
    const values = Object.values(areas);
    if(window.myChart) window.myChart.destroy();
    window.myChart = new Chart(ctx, {
      type:'bar',
      data:{ labels, datasets:[{ label:'Respostas por área', data:values, backgroundColor:'rgba(75,192,192,0.6)'}] },
      options:{ responsive:true, scales:{ y:{ beginAtZero:true } } }
    });
  };

  const renderForm = () => {
    const questions = formsByArea[userArea];
    return questions.map((q,i)=>(
      <div key={i} className="question">
        <label>{q.label}</label>
        {q.type==="text" && <input type="text" id={`q${i}`} />}
        {q.type==="textarea" && <textarea id={`q${i}`} rows={3}></textarea>}
        {q.type==="radio" && q.options.map((o,j)=><label key={j}><input type="radio" name={`q${i}`} value={o}/> {o}</label>)}
        {q.type==="checkbox" && q.options.map((o,j)=><label key={j}><input type="checkbox" name={`q${i}`} value={o}/> {o}</label>)}
      </div>
    ));
  };

  if(screen==="login") return (
    <div className="container">
      <h1>Login</h1>
      <button onClick={handleLogin}>Entrar com Google</button>
    </div>
  );

  if(screen==="area") return (
    <div className="container">
      <h1>Selecione sua área</h1>
      <select value={userArea} onChange={e=>setUserArea(e.target.value)}>
        <option value="">Selecione...</option>
        <option value="estudante">Estudante</option>
        <option value="pessoal">Pessoal</option>
        <option value="criador">Criador de Conteúdo</option>
        <option value="comercial">Comercial</option>
        <option value="pequenaEmpresa">Pequena Empresa</option>
        <option value="freelancer">Freelancer</option>
      </select>
      <button onClick={saveArea}>Próximo</button>
    </div>
  );

  if(screen==="form") return (
    <div className="container">
      <h1>Formulário - {userArea.charAt(0).toUpperCase()+userArea.slice(1)}</h1>
      {renderForm()}
      <button onClick={submitForm}>Enviar Resposta</button>
    </div>
  );

  if(screen==="admin") return (
    <div className="container">
      <h1>Painel ADM</h1>
      <canvas id="chart"></canvas>
      <table>
        <thead><tr><th>Email</th><th>Área</th><th>Respostas</th></tr></thead>
        <tbody>
          {responses.map((d,i)=><tr key={i}><td>{d.email}</td><td>{d.area}</td><td>{JSON.stringify(d.answers)}</td></tr>)}
        </tbody>
      </table>
    </div>
  );

  return null;
    }
