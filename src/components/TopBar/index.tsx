import Link from "next/link";
import ConnectButton from "../ConnectButton";
import NavBar from "./NavBar";

const TopBar = () => {
  return (
    <div className="fixed top-0 w-full">
      <div className="relative flex w-full items-center px-4  py-4 shadow">
        <Link href="/" className="text-lg font-bold">
          Marketplace
        </Link>
        <div className="flex-grow">
          <NavBar />
        </div>
        <ConnectButton />
      </div>
    </div>
  );
};

export default TopBar;