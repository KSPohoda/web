<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN">
<html>
<head>
<meta http-equiv="content-type" content="text/html; charset=windows-1250">
<title>Odesílání emailu</title>
</head>
<body>
<h1>Odesílání emailu</h1>

<?
$predmet = "Prihlaska ".$_POST['prijmeni'];
$email = $_POST['prijmeni']."@".$_POST['pocet']."cz";
$spam = $_POST['spam'];
$zprava = $_POST['prijmeni']." Pocet ".$_POST['pocet']." mail: ".$_POST['mail']." Pozn: ".$_POST['S2'];
$email =$_POST['mail'];

if ($predmet!="" and $email!="" and $zprava!="" and $spam=="2")
{
Mail("kspohoda@volny.cz", $predmet, $zprava, "From: " . $email);
echo "<p><strong>Váš e-mail byl úspěšně odeslán</strong>.</p>";
}
else
{
echo "<p>Váš e-mail se <strong>nepodařilo odeslat</strong> pravděpodobně jste nevyplnili všechny údaje, nebo nevíte kolik je 1 + 1.</p>";
}
?>
<p align="left"><b><a href="pozvanka_zari.html">Zpět</a></b></p>

</body>
</html>