var DateInterface=function e(t){var a={},i;return a.options={targetEl:$(".container"),edgeType:"Dyad",heading:"Default Heading"},extend(a.options,t),a.init=function(){a.options.targetEl.append("<h1>"+a.options.heading+"</h1>"),a.options.targetEl.append('<p class="lead">'+a.options.subheading+"</p>"),a.options.targetEl.append('<div class="date-container"></div>'),i=network.getEdges(a.options.criteria),console.log(i);var e=0,t=0;$.each(i,function(a,i){var s=network.getEdges({type:"Dyad",from:network.getNodes({type_t0:"Ego"})[0].id,to:i.to})[0],r='<div class="date-picker-item overlay"><div class="row"><div class="col-sm-12"><h2>Regarding <span>'+s.nname_t0+'</span></h2></div></div><div class="row"><div class="alert alert-danger logic-error" role="alert"><span class="glyphicon glyphicon-exclamation-sign" aria-hidden="true"></span><span class="sr-only">Error:</span> Your last sexual encounter cannot come before your first. Please correct the dates before continuing.</div><div class="col-sm-5"><div class="form-group"><p class="lead">When was the first time you had sex?</p><div class="input-group date first row'+t+'" id="datetimepicker'+e+'"><input type="text" class="form-control" readonly /><span class="input-group-addon"><span class="glyphicon glyphicon-calendar"></span></span></div></div></div><div class="col-sm-5 col-sm-offset-2"><div class="form-group"><p class="lead">When was the last time you had sex?</p><div class="input-group date second row'+t+'" id="datetimepicker'+(e+1)+'"><input type="text" class="form-control" readonly /><span class="input-group-addon"><span class="glyphicon glyphicon-calendar"></span></span></div></div></div></div></div>';$(r).appendTo(".date-container");var n={format:"MM/DD/YYYY"};$("#datetimepicker"+e).datetimepicker(n),$("#datetimepicker"+(e+1)).datetimepicker(n),$(".row"+t).on("dp.change",function(e){console.log("change");var t={},a,s,r,n=$(this);$(this).hasClass("first")?(a=parseInt(n.attr("id").slice(-1))+1,s=parseInt(n.attr("id").slice(-1)),r=parseInt(n.attr("id").slice(-1))+1,$("#datetimepicker"+a).data("DateTimePicker").minDate(e.date),t={sex_first_t0:n.data("DateTimePicker").date().format("MM/DD/YYYY")}):(a=parseInt(n.attr("id").slice(-1))-1,s=parseInt(n.attr("id").slice(-1))-1,r=parseInt(n.attr("id").slice(-1)),$("#datetimepicker"+a).data("DateTimePicker").minDate(e.date),t={sex_last_t0:n.data("DateTimePicker").date().format("MM/DD/YYYY")}),moment($("#datetimepicker"+s).data("DateTimePicker").date()).isAfter($("#datetimepicker"+r).data("DateTimePicker").date())?(n.parent().parent().parent().children(".logic-error").fadeIn(),$(".arrow-next").attr("disabled","disabled")):(n.parent().parent().parent().children(".logic-error").fadeOut(),$(".arrow-next").removeAttr("disabled")),network.updateEdge(i.id,t)}),"undefined"!=typeof i.sex_first_t0&&(console.log("first:"),console.log(i.sex_first_t0),$("#datetimepicker"+e).data("DateTimePicker").date(i.sex_first_t0)),"undefined"!=typeof i.sex_last_t0&&(console.log("last:"),console.log(i.sex_last_t0),$("#datetimepicker"+(e+1)).data("DateTimePicker").date(i.sex_last_t0)),e+=2,t++})},a.destroy=function(){},a.init(),a};