<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN">
<html>
<head>
<meta http-equiv="content-type" content="text/html; charset=windows-1250">
<title>Odes�l�n� emailu</title>
</head>
<body>
<h1>Odes�l�n� emailu</h1>

<?
$predmet = "Prihlaska ".$_POST['prijmeni'];
$email = $_POST['prijmeni']."@".$_POST['pocet']."cz";
$spam = $_POST['spam'];
$zprava = $_POST['prijmeni']." Pocet ".$_POST['pocet']." mail: ".$_POST['mail']." Pozn: ".$_POST['S2'];
$email =$_POST['mail'];

if ($predmet!="" and $email!="" and $zprava!="" and $spam=="2")
{
Mail("kspohoda@volny.cz", $predmet, $zprava, "From: " . $email);
echo "<p><strong>V� e-mail byl �sp�n� odesl�n</strong>.</p>";
}
else
{
echo "<p>V� e-mail se <strong>nepoda�ilo odeslat</strong> pravd�podobn� jste nevyplnili v�echny �daje, nebo nev�te kolik je 1 + 1.</p>";
}
?>
<p align="left"><b><a href="pozvanka_zari.html">Zp�t</a></b></p>

</body>
</html>