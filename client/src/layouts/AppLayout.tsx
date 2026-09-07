import { NavLink, Outlet, useNavigate } from 'react-router-dom';

const items = [['/app','Dashboard'],['/app/vision','Vision Camera'],['/app/history','History'],['/app/profile','Profile'],['/app/settings','Settings']];
export function AppLayout() {
  const navigate = useNavigate();
  return <div className="shell"><aside className="sidebar"><div className="brand"><span>NEXA</span><small>VISION AI</small></div><div className="system"><i/> SYSTEM ONLINE</div><nav>{items.map(([to,label]) => <NavLink key={to} to={to}>{label}</NavLink>)}</nav><button className="logout" onClick={() => navigate('/login')}>LOGOUT</button></aside><main className="workspace"><header className="mobile-head"><div className="brand"><span>NEXA</span><small>VISION AI</small></div><div className="status"><i/> ONLINE</div></header><Outlet/></main><nav className="bottom-nav">{items.slice(0,4).map(([to,label]) => <NavLink key={to} to={to}>{label.split(' ')[0]}</NavLink>)}</nav></div>;
}
