import { API_URL } from '../../config/index'
import Layout from '../../components/Layout'

export default function EmployeePage(props) {
  return (
    <Layout>
      <h1>{props.employee.data.firstName}</h1>
    </Layout>
  )
}

// export async function getStaticPaths() {
//   const res = await fetch(`${API_URL}/api/employees`)
//   const employees = await res.json()

//   const paths = employees.data.map((employee) => ({
//     params: { id: employee._id },
//   }))

//   return {
//     paths,
//     fallback: false,
//   }
// }

// export async function getStaticProps({ params: { id } }) {
//   const res = await fetch(`${API_URL}/api/employees/${id}`)
//   console.log(res)
//   const employee = await res.json()

//   return {
//     props: {
//       employee,
//     },
//     revalidate: 1,
//   }
// }


export async function getServerSideProps({ query: { id } }) {
  const res = await fetch(`${API_URL}/api/employees/${id}`)
  const employee = await res.json()

  return {
    props: {
      employee,
    },
  }
}