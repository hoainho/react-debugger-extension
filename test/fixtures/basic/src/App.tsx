import UserCard from './UserCard'

function App() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6' }}>
      <UserCard name="Jane Smith" role="Senior Engineer" />
    </div>
  )
}

export default App