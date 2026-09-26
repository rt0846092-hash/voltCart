import { Link } from "react-router-dom";
import { Button, Empty } from "../components/ui";

export default function NotFound() {
  return (
    <Empty title="Page not found" action={<Button as={Link} to="/">Go home</Button>}>
      The page you're looking for doesn't exist.
    </Empty>
  );
}
