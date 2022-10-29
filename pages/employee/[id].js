import { API_URL } from '../../config/index'
import Layout from '../../components/Layout'

export default function EmployeePage(props) {
  const { employee } = props
  
  return (
    <Layout>
      <h1>{employee.data.firstName}</h1>
    </Layout>
  )
}


export async function getServerSideProps({ query: { id } }) {
  const res = await fetch(`${API_URL}/api/employees/${id}`)
  const employee = await res.json()

  return {
    props: {
      employee,
    },
  }
}